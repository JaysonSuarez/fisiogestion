export type SessionFrequency = 'todos_los_dias' | 'dia_de_por_medio' | 'lunes_miercoles_viernes' | 'custom'

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

function weekday(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function advance(date: string, frequency: SessionFrequency) {
  if (frequency === 'todos_los_dias' || frequency === 'custom') return addDays(date, 1)
  if (frequency === 'dia_de_por_medio') return addDays(date, 2)

  const day = weekday(date)
  if (day === 1 || day === 3) return addDays(date, 2)
  if (day === 5) return addDays(date, 3)
  return addDays(date, 1)
}

function isScheduledWeekday(date: string, frequency: SessionFrequency, customDays: number[]) {
  const day = weekday(date)
  if (frequency === 'custom') return customDays.includes(day)
  if (frequency === 'lunes_miercoles_viernes') return day === 1 || day === 3 || day === 5
  return true
}

function moveToAllowedDate(
  date: string,
  frequency: SessionFrequency,
  customDays: number[],
  allowSunday: boolean,
  appointmentTime: string,
) {
  let candidate = date
  for (let attempts = 0; attempts < 14; attempts++) {
    const day = weekday(candidate)
    const sundayHasClinicHours = ['08:00', '09:00', '10:00', '11:00'].includes(appointmentTime.slice(0, 5))
    const closedWeekend = day === 6 || (day === 0 && (!allowSunday || !sundayHasClinicHours))
    if (!closedWeekend && isScheduledWeekday(candidate, frequency, customDays)) return candidate
    candidate = addDays(candidate, 1)
  }
  throw new Error('No encontramos fechas disponibles con esa frecuencia.')
}

export function planSessionDates(
  firstDate: string,
  count: number,
  frequency: SessionFrequency,
  customDays: number[] = [],
  allowSunday = false,
  appointmentTime = '08:00',
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate) || count < 1 || (frequency === 'custom' && customDays.length === 0)) return []

  const dates: string[] = []
  let candidate = firstDate
  while (dates.length < count) {
    const scheduled = moveToAllowedDate(candidate, frequency, customDays, allowSunday, appointmentTime)
    dates.push(scheduled)
    candidate = advance(scheduled, frequency)
  }
  return dates
}
