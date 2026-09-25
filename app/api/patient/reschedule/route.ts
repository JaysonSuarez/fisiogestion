import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isHolidayColombia } from '@/lib/colombian-holidays'
import { sendPushToFisio } from '@/lib/server/push'
import { appointmentScheduleConflict, planAppointmentSeriesReschedule, type SeriesAppointment } from '@/lib/appointment-series'

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
      .select('id,paciente_id,sesion_id,fecha,hora_inicio,duracion_minutos,estado,fisioterapeuta,notas')
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

    let planAppointments: SeriesAppointment[] = [cita]
    if (cita.sesion_id) {
      const { data, error } = await admin.from('citas')
        .select('id,fecha,hora_inicio,estado,notas,duracion_minutos,fisioterapeuta')
        .eq('sesion_id', cita.sesion_id).eq('paciente_id', profile.paciente_id)
      if (error) throw error
      planAppointments = (data || []) as SeriesAppointment[]
    }
    const changes = planAppointmentSeriesReschedule(planAppointments, citaId, fecha, hora)
    for (const change of changes) {
      const changeDay = new Date(`${change.fecha}T12:00:00`).getDay()
      const changeIsHoliday = isHolidayColombia(change.fecha)
      const changeSlots = changeDay === 0 || changeIsHoliday ? HOLIDAY_SLOTS : changeDay === 6 ? new Set<string>() : WEEKDAY_SLOTS
      if (!changeSlots.has(change.hora_inicio.slice(0, 5))) {
        return NextResponse.json({ error: `Al mover las sesiones, el horario del ${change.fecha} no está disponible para atención. Elige otra fecha u hora.` }, { status: 400 })
      }
    }

    const targetDates = Array.from(new Set(changes.map(change => change.fecha)))
    const { data: busy, error: busyError } = await admin.from('citas')
      .select('id,fecha,hora_inicio,duracion_minutos,fisioterapeuta')
      .in('fecha', targetDates).neq('estado', 'cancelada')
    if (busyError) throw busyError
    const conflict = appointmentScheduleConflict(changes, busy || [], planAppointments)
    if (conflict) return NextResponse.json({ error: `El horario del ${conflict.fecha} acaba de ocuparse. Elige otra fecha u hora.` }, { status: 409 })

    const oldDate = cita.fecha
    const oldTime = String(cita.hora_inicio).slice(0, 5)
    const { error: updateError } = await admin.rpc('reschedule_appointment_series', { p_updates: changes })
    if (updateError) {
      if (updateError.code === '23P01' || updateError.code === '23505') {
        return NextResponse.json({ error: 'Ese horario acaba de ocuparse. Elige otro disponible.' }, { status: 409 })
      }
      throw updateError
    }
    const { data: updatedAppointments, error: readError } = await admin.from('citas')
      .select('id,fecha,hora_inicio,estado')
      .in('id', changes.map(change => change.id))
    if (readError) throw readError
    const updated = updatedAppointments?.find(appointment => appointment.id === citaId)
    if (!updated) return NextResponse.json({ error: 'No pudimos actualizar la cita. Recarga e inténtalo de nuevo.' }, { status: 409 })

    await sendPushToFisio(
      'Liliana',
      'Un paciente reagendó una cita',
      `${profile.nombre || 'Un paciente'} cambió su cita del ${oldDate} a las ${oldTime} para el ${fecha} a las ${hora}${changes.length > 1 ? ` y se movieron ${changes.length - 1} sesiones posteriores` : ''}.`,
      '/agenda',
    )
    const assignedFisio = (cita.fisioterapeuta || 'Liliana') as 'Liliana' | 'Jeniffer'
    if (assignedFisio !== 'Liliana') {
      await sendPushToFisio(
        assignedFisio,
        'Un paciente actualizó su horario',
        `${profile.nombre || 'Un paciente'} cambió su cita para el ${fecha} a las ${hora}${changes.length > 1 ? ` y se movieron ${changes.length - 1} sesiones posteriores` : ''}.`,
        '/agenda',
      )
    }

    return NextResponse.json({ success: true, cita: updated, citas: updatedAppointments || [] })
  } catch (error: any) {
    console.error('No se pudo reagendar la cita:', error)
    return NextResponse.json({ error: error.message || 'No se pudo reagendar la cita.' }, { status: 500 })
  }
}
