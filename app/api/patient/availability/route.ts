import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para consultar horarios.' }, { status: 401 })

  try {
    const admin = getSupabaseAdmin()
    const { data: profile } = await admin.from('patient_profiles').select('id').eq('id', user.id).maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Cuenta de paciente requerida.' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'Rango de fechas inválido.' }, { status: 400 })
    }
    if (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime() > 31 * 86400000) {
      return NextResponse.json({ error: 'Consulta un máximo de un mes a la vez.' }, { status: 400 })
    }

    const { data, error } = await admin.from('citas')
      .select('fecha,hora_inicio,duracion_minutos,estado')
      .gte('fecha', from).lte('fecha', to)
      .neq('estado', 'cancelada')
    if (error) throw error

    return NextResponse.json({ citas: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No se pudieron consultar los horarios.' }, { status: 500 })
  }
}
