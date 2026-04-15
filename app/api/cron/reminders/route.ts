import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Verificación de seguridad simple para Vercel Cron
  // En producción, Vercel envía un header especial: Authorization: Bearer {CRON_SECRET}
  const authHeader = req.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return new Response('Unauthorized', { status: 401 })
    // Nota: Por ahora lo dejamos abierto para que puedas probarlo manualmente
  }

  try {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    
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
      const citaTime = new Date()
      citaTime.setHours(hours, minutes, 0, 0)

      const diffMs = citaTime.getTime() - now.getTime()
      const minsRemaining = Math.floor(diffMs / 60000)

      // --- Notificación de 1 hora (entre 55 y 65 min) ---
      if (minsRemaining > 50 && minsRemaining <= 65 && !cita.notificado_1h) {
        const title = 'Recordatorio de Cita ⏰'
        const body = `Cita con ${cita.pacientes?.nombre} en 1 hora aproximadamente.`
        
        await triggerPush(title, body, `/agenda?cita_id=${cita.id}`)
        
        await supabase.from('citas').update({ notificado_1h: true }).eq('id', cita.id)
        results.push(`Sent 1h reminder for ${cita.pacientes?.nombre}`)
      }

      // --- Notificación de 10 minutos (entre 0 y 15 min) ---
      if (minsRemaining > 0 && minsRemaining <= 15 && !cita.notificado_10m) {
        const title = '¡Cita en 10 minutos! 🚨'
        const body = `La sesión con ${cita.pacientes?.nombre} empieza pronto.`
        
        await triggerPush(title, body, `/agenda?cita_id=${cita.id}`)
        
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

async function triggerPush(title: string, body: string, url: string) {
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`
  
  await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ title, body, url })
  })
}
