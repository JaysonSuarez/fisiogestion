export type SeriesAppointment = {
  id: string
  fecha: string
  hora_inicio: string
  estado?: string | null
  notas?: string | null
  duracion_minutos?: number | null
  fisioterapeuta?: string | null
}

export type AppointmentScheduleChange = {
  id: string
  fecha: string
  hora_inicio: string
}

function sessionNumber(appointment: SeriesAppointment) {
  const match = appointment.notas?.match(/(?:sesi[oó]n|cita)\s+(\d+)\s*\//i)
  return match ? Number(match[1]) : null
}

function compareAppointments(a: SeriesAppointment, b: SeriesAppointment) {
  const aNumber = sessionNumber(a)
  const bNumber = sessionNumber(b)
  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) return aNumber - bNumber
  return `${a.fecha}T${a.hora_inicio}`.localeCompare(`${b.fecha}T${b.hora_inicio}`) || a.id.localeCompare(b.id)
}

function dayDifference(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((toUtc - fromUtc) / 86_400_000)
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

export function planAppointmentSeriesReschedule(
  appointments: SeriesAppointment[],
  appointmentId: string,
  fecha: string,
  hora: string,
): AppointmentScheduleChange[] {
  const ordered = [...appointments].sort(compareAppointments)
  const selectedIndex = ordered.findIndex(appointment => appointment.id === appointmentId)
  if (selectedIndex < 0) throw new Error('No encontramos la cita que quieres reprogramar.')

  const selected = ordered[selectedIndex]
  const shiftDays = dayDifference(selected.fecha, fecha)
  return ordered.slice(selectedIndex)
    .filter(appointment => !['cancelada', 'completada', 'completado'].includes((appointment.estado || '').toLowerCase()))
    .map(appointment => ({
      id: appointment.id,
      fecha: addDays(appointment.fecha, shiftDays),
      hora_inicio: hora,
    }))
}

export function appointmentScheduleConflict(
  changes: AppointmentScheduleChange[],
  busyAppointments: Array<{ id: string; fecha: string; hora_inicio: string; duracion_minutos?: number | null; fisioterapeuta?: string | null }>,
  movingAppointments: SeriesAppointment[],
) {
  const movingIds = new Set(changes.map(change => change.id))
  const movingById = new Map(movingAppointments.map(appointment => [appointment.id, appointment]))
  const occupied = busyAppointments.filter(appointment => !movingIds.has(appointment.id))
  const placed: Array<AppointmentScheduleChange & { fisioterapeuta?: string | null; duracion_minutos?: number | null }> = []

  for (const change of changes) {
    const moving = movingById.get(change.id)
    const therapist = moving?.fisioterapeuta || 'Liliana'
    const [hour, minute] = change.hora_inicio.slice(0, 5).split(':').map(Number)
    const start = hour * 60 + minute
    const duration = moving?.duracion_minutos || 60
    const conflicts = [...occupied, ...placed].some(appointment => {
      if (appointment.fecha !== change.fecha || (appointment.fisioterapeuta || 'Liliana') !== therapist) return false
      const [otherHour, otherMinute] = appointment.hora_inicio.slice(0, 5).split(':').map(Number)
      const otherStart = otherHour * 60 + otherMinute
      const otherDuration = appointment.duracion_minutos || 60
      return start < otherStart + otherDuration && otherStart < start + duration
    })
    if (conflicts) return change
    placed.push({ ...change, fisioterapeuta: therapist, duracion_minutos: duration })
  }
  return null
}
