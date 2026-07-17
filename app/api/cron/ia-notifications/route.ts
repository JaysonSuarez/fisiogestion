import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CohereClient } from 'cohere-ai'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY!,
  })

  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. Obtener todos los pacientes (para simplificar, podríamos traer solo los que tienen diagnostico)
    const { data: perfiles } = await supabase
      .from('patient_profiles')
      .select('id, nombre, diagnostico')
      .neq('diagnostico', '')
      .not('diagnostico', 'is', null)

    if (!perfiles || perfiles.length === 0) {
      return NextResponse.json({ message: 'No hay perfiles con diagnóstico' })
    }

    // 2. Obtener a quiénes ya se les envió hoy
    const { data: logs } = await supabase
      .from('log_notificaciones_ia')
      .select('patient_id')
      .eq('fecha', today)

    const sentIds = new Set((logs || []).map(l => l.patient_id))

    // 3. Filtrar candidatos (no se les ha enviado hoy)
    const candidates = perfiles.filter(p => !sentIds.has(p.id))

    if (candidates.length === 0) {
      return NextResponse.json({ message: 'Todos los candidatos ya recibieron notificación hoy' })
    }

    const results = []

    // 4. Seleccionar un subconjunto aleatorio (ej: 10% de probabilidad por candidato, o simplemente elegir 1 o 2 al azar)
    // Para asegurar que alguien reciba algo y no saturar la API, elegiremos 1 candidato al azar en cada ejecución del cron.
    const randomIndex = Math.floor(Math.random() * candidates.length)
    const target = candidates[randomIndex]

    // 5. Generar mensaje con Cohere
    const prompt = `Actúa como Liliana, una fisioterapeuta profesional y empática. 
El paciente se llama ${target.nombre} y su diagnóstico o motivo de consulta es: "${target.diagnostico}".
Escribe un mensaje push notification CORTO (máximo 120 caracteres) para enviarle hoy.
Debe ser un mensaje motivacional, empático, que le recuerde cuidar su postura o hacer sus ejercicios, o que le recuerde que estás ahí para ayudarle con su molestia.
No uses comillas en la respuesta, solo devuelve el texto directo. Usa emojis.`

    const cohereResponse = await cohere.generate({
      model: 'command',
      prompt: prompt,
      maxTokens: 50,
      temperature: 0.7,
    })

    const generatedMessage = cohereResponse.generations[0].text.trim().replace(/^"|"$/g, '')

    // 6. Enviar Notificación Push (reutilizando send-push)
    const pushResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        target_user_id: target.id, // Si send-push se actualiza para soportarlo, o podemos iterar
        title: 'Un mensaje de Liliana 💖',
        body: generatedMessage,
        url: '/app'
      })
    })

    // 7. Guardar Log
    await supabase.from('log_notificaciones_ia').insert({
      patient_id: target.id,
      fecha: today
    })

    results.push({
      paciente: target.nombre,
      mensaje: generatedMessage,
      pushStatus: pushResponse.status
    })

    return NextResponse.json({ success: true, notificados: results })

  } catch (err: any) {
    console.error('IA Cron Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
