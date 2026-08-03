import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Verificación de seguridad: solo se permite con el CRON_SECRET.
  // El scheduler real ahora vive en Supabase (pg_cron); este endpoint queda
  // como respaldo manual protegido para que nadie lo dispare por fuera.
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const now = new Date()
    
    // Configurar la zona horaria a Colombia (UTC-5)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    const parts = formatter.formatToParts(now)
    const timeObj: Record<string, string> = {}
    parts.forEach(p => { timeObj[p.type] = p.value })
    
    const todayStr = `${timeObj.year}-${timeObj.month}-${timeObj.day}`
    
    let currentHour = parseInt(timeObj.hour, 10)
    if (currentHour === 24) currentHour = 0
    const currentMinute = parseInt(timeObj.minute, 10)
    const currentMinsFromMidnight = currentHour * 60 + currentMinute
    
    // 1. Buscar citas de hoy pendientes
    const { data: citas, error } = await supabase
      .from('citas')
      .select('*, pacientes(nombre, telefono)')
      .eq('fecha', todayStr)
      .neq('estado', 'cancelada')
      .neq('estado', 'completada')

    if (error) throw error

    const results = []

    for (const cita of citas) {
      const [hours, minutes] = cita.hora_inicio.split(':').map(Number)
      const citaMinsFromMidnight = hours * 60 + minutes
      const minsRemaining = citaMinsFromMidnight - currentMinsFromMidnight

      // --- Notificación de 1 hora (entre 55 y 65 min) ---
      if (minsRemaining > 50 && minsRemaining <= 65 && !cita.notificado_1h) {
        const title = 'Recordatorio de Cita ⏰'
        const body = `Cita con ${cita.pacientes?.nombre} en 1 hora aproximadamente.`
        
        await triggerPush(title, body, `/agenda?cita_id=${cita.id}`, cita.fisioterapeuta)

        await supabase.from('citas').update({ notificado_1h: true }).eq('id', cita.id)
        results.push(`Sent 1h reminder for ${cita.pacientes?.nombre}`)
      }

      // --- Notificación de 10 minutos (entre 0 y 15 min) ---
      if (minsRemaining > 0 && minsRemaining <= 15 && !cita.notificado_10m) {
        const title = '¡Cita en 10 minutos! 🚨'
        const body = `La sesión con ${cita.pacientes?.nombre} empieza pronto.`
        
        await triggerPush(title, body, `/agenda?cita_id=${cita.id}`, cita.fisioterapeuta)

        await supabase.from('citas').update({ notificado_10m: true }).eq('id', cita.id)
        results.push(`Sent 10m reminder for ${cita.pacientes?.nombre}`)
      }
    }

    return NextResponse.json({ success: true, processed: results })

  } catch (err: any) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// El recordatorio va SOLO a la fisioterapeuta de esa cita. Antes se enviaba sin
// destinatario, y la Edge Function acababa notificando a todos los dispositivos
// registrados: las otras fisioterapeutas recibían citas ajenas y los pacientes,
// recordatorios que no eran para ellos.
async function triggerPush(title: string, body: string, url: string, fisioterapeuta?: string) {
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`

  await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      title,
      body,
      url,
      target_fisio: fisioterapeuta || 'Liliana',
    })
  })
}
