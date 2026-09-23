import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPushToFisio } from '@/lib/server/push'

export async function POST(req: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  try {
    const admin = getSupabaseAdmin()
    const { data: profile, error: profileError } = await admin.from('patient_profiles')
      .select('id,paciente_id,nombre,apellido').eq('id', user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile?.paciente_id) return NextResponse.json({ error: 'Solo los pacientes pueden solicitar este aviso.' }, { status: 403 })

    const { evaluationId } = await req.json()
    if (typeof evaluationId !== 'string') return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 })

    const { data: evaluation, error: evaluationError } = await admin.from('evaluaciones')
      .select('id,tipo').eq('id', evaluationId).eq('paciente_id', profile.paciente_id)
      .eq('estado', 'completada').maybeSingle()
    if (evaluationError) throw evaluationError
    if (!evaluation) return NextResponse.json({ error: 'El documento no está disponible para este paciente.' }, { status: 404 })

    const patientName = [profile.nombre, profile.apellido].filter(Boolean).join(' ')
    const docName = evaluation.tipo === 'inicial' ? 'la valoración' : 'la re-evaluación'
    const result = await sendPushToFisio(
      'Liliana',
      'Documento descargado desde la app',
      `${patientName} descargó ${docName}.`,
      '/evaluaciones',
    )

    if (!result.delivered) {
      return NextResponse.json({ success: false, notified: false }, { status: 502 })
    }
    return NextResponse.json({ success: true, notified: true })
  } catch (error: any) {
    console.error('No se pudo notificar la descarga del documento:', error)
    return NextResponse.json({ error: 'No se pudo enviar el aviso.' }, { status: 500 })
  }
}
