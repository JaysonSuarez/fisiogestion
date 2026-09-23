import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const staff = await getApiUser()
  if (!staff) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const admin = getSupabaseAdmin()
    const { data: patientAccount } = await admin.from('patient_profiles').select('id').eq('id', staff.id).maybeSingle()
    if (patientAccount) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })

    const { pacienteId, tipo } = await req.json()
    if (typeof pacienteId !== 'string' || !['inicial', 'reevaluacion'].includes(tipo)) {
      return NextResponse.json({ error: 'Evaluación inválida.' }, { status: 400 })
    }
    const { data: evaluation } = await admin.from('evaluaciones').select('id')
      .eq('paciente_id', pacienteId).eq('tipo', tipo).eq('estado', 'completada').maybeSingle()
    if (!evaluation) return NextResponse.json({ error: 'La evaluación todavía no está disponible.' }, { status: 409 })

    const { data: patient } = await admin.from('patient_profiles').select('id,nombre')
      .eq('paciente_id', pacienteId).maybeSingle()
    if (!patient) return NextResponse.json({ success: true, notified: false })

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        target_user_id: patient.id,
        title: tipo === 'inicial' ? 'Tu valoración está lista' : 'Tu re-evaluación está lista',
        body: 'Ya puedes consultar y descargar el documento desde la app.',
        url: '/app/documentos',
      }),
    })
    const result = await response.json().catch(() => ({}))
    const notified = response.ok && result?.success === true
    if (!notified) console.error('La valoración se guardó, pero no se entregó el push al paciente:', result?.error || response.status)
    return NextResponse.json({ success: true, notified }, { status: notified ? 200 : 502 })
  } catch (error: any) {
    console.error('No se pudo avisar que la evaluación está lista:', error)
    return NextResponse.json({ error: 'No se pudo enviar el aviso.' }, { status: 500 })
  }
}
