import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isHolidayColombia } from '@/lib/colombian-holidays'
import { sendPushToFisio } from '@/lib/server/push'

export const dynamic = 'force-dynamic'

const WEEKDAY_SLOTS = new Set(['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'])
const HOLIDAY_SLOTS = new Set(['08:00', '09:00', '10:00', '11:00'])

function bogotaNowKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export async function POST(req: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para reagendar tu cita.' }, { status: 401 })

  try {
    const body = await req.json()
    const citaId = String(body.citaId || '')
    const fecha = String(body.fecha || '')
    const hora = String(body.hora || '')
    if (!/^[0-9a-f-]{36}$/i.test(citaId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json({ error: 'Selecciona una fecha y hora válidas.' }, { status: 400 })
    }
    const nowKey = bogotaNowKey()
    const today = nowKey.slice(0, 10)
    const [year, month, date] = fecha.split('-').map(Number)
    const candidateDate = new Date(Date.UTC(year, month - 1, date, 12))
    const dateIsValid = candidateDate.getUTCFullYear() === year && candidateDate.getUTCMonth() === month - 1 && candidateDate.getUTCDate() === date
    const latestDate = new Date(`${today}T12:00:00Z`)
    latestDate.setUTCDate(latestDate.getUTCDate() + 30)
    if (!dateIsValid || fecha > latestDate.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Elige una fecha dentro de los próximos 30 días.' }, { status: 400 })
    }
    if (`${fecha}T${hora}` <= nowKey) {
      return NextResponse.json({ error: 'Elige un horario futuro.' }, { status: 400 })
    }

    const day = new Date(`${fecha}T12:00:00`).getDay()
    const isHoliday = isHolidayColombia(fecha)
    const validSlots = day === 0 || isHoliday ? HOLIDAY_SLOTS : day === 6 ? new Set<string>() : WEEKDAY_SLOTS
    if (!validSlots.has(hora)) {
      return NextResponse.json({ error: 'Ese horario no está dentro de los horarios de atención.' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: profile, error: profileError } = await admin.from('patient_profiles')
      .select('id,paciente_id,nombre').eq('id', user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile?.paciente_id) return NextResponse.json({ error: 'Cuenta de paciente requerida.' }, { status: 403 })

    const { data: cita, error: citaError } = await admin.from('citas')
      .select('id,paciente_id,fecha,hora_inicio,duracion_minutos,estado,fisioterapeuta')
      .eq('id', citaId).eq('paciente_id', profile.paciente_id).maybeSingle()
    if (citaError) throw citaError
    if (!cita) return NextResponse.json({ error: 'No encontramos esa cita.' }, { status: 404 })
    if (cita.estado === 'cancelada' || cita.estado === 'completada') {
      return NextResponse.json({ error: 'Esta cita ya no se puede reagendar.' }, { status: 409 })
    }
    if (`${cita.fecha}T${String(cita.hora_inicio).slice(0, 5)}` <= bogotaNowKey()) {
      return NextResponse.json({ error: 'Solo puedes reagendar citas que todavía no han comenzado.' }, { status: 409 })
    }
    if (cita.fecha === fecha && String(cita.hora_inicio).slice(0, 5) === hora) {
      return NextResponse.json({ error: 'Elige un horario diferente al actual.' }, { status: 400 })
    }

    const { data: busy, error: busyError } = await admin.from('citas')
      .select('hora_inicio,duracion_minutos')
      .eq('fecha', fecha).neq('estado', 'cancelada').neq('id', citaId)
    if (busyError) throw busyError
    const [hour, minute] = hora.split(':').map(Number)
    const start = hour * 60 + minute
    const duration = cita.duracion_minutos || 60
    const overlaps = (busy || []).some(appointment => {
      const [busyHour, busyMinute] = String(appointment.hora_inicio).slice(0, 5).split(':').map(Number)
      const busyStart = busyHour * 60 + busyMinute
      return start < busyStart + (appointment.duracion_minutos || 60) && busyStart < start + duration
    })
    if (overlaps) return NextResponse.json({ error: 'Ese horario acaba de ocuparse. Elige otro disponible.' }, { status: 409 })

    const oldDate = cita.fecha
    const oldTime = String(cita.hora_inicio).slice(0, 5)
    const { data: updated, error: updateError } = await admin.from('citas')
      .update({ fecha, hora_inicio: hora })
      .eq('id', citaId).eq('paciente_id', profile.paciente_id)
      .select('id,fecha,hora_inicio,estado')
      .maybeSingle()
    if (updateError) {
      if (updateError.code === '23P01' || updateError.code === '23505') {
        return NextResponse.json({ error: 'Ese horario acaba de ocuparse. Elige otro disponible.' }, { status: 409 })
      }
      throw updateError
    }
    if (!updated) return NextResponse.json({ error: 'No pudimos actualizar la cita. Recarga e inténtalo de nuevo.' }, { status: 409 })

    await sendPushToFisio(
      'Liliana',
      'Un paciente reagendó una cita',
      `${profile.nombre || 'Un paciente'} cambió su cita del ${oldDate} a las ${oldTime} para el ${fecha} a las ${hora}.`,
      '/agenda',
    )
    const assignedFisio = (cita.fisioterapeuta || 'Liliana') as 'Liliana' | 'Jeniffer'
    if (assignedFisio !== 'Liliana') {
      await sendPushToFisio(
        assignedFisio,
        'Un paciente actualizó su horario',
        `${profile.nombre || 'Un paciente'} cambió su cita para el ${fecha} a las ${hora}.`,
        '/agenda',
      )
    }

    return NextResponse.json({ success: true, cita: updated })
  } catch (error: any) {
    console.error('No se pudo reagendar la cita:', error)
    return NextResponse.json({ error: error.message || 'No se pudo reagendar la cita.' }, { status: 500 })
  }
}
