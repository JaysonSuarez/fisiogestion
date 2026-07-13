export const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

export const format12h = (hora24: string) => {
  if (!hora24) return ''
  const [h, m] = hora24.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  const minutes = m !== undefined ? m.toString().padStart(2, '0') : '00'
  return `${h12}:${minutes} ${period}`
}

export const getIniciales = (nombre: string) => {
  if (!nombre) return '?'
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

export const getMesesDisponibles = () => {
  const meses = []
  const start = new Date(2024, 0, 1)
  const end = new Date()
  
  // En caso de que estemos antes de 2024, garantizamos que al menos esté el mes actual
  if (end < start) {
      return [getCurrentMonthStr()]
  }
  
  while (start <= end) {
    const year = start.getFullYear()
    const month = String(start.getMonth() + 1).padStart(2, '0')
    meses.push(`${year}-${month}`)
    start.setMonth(start.getMonth() + 1)
  }
  return meses.reverse()
}

export const formatMes = (yyyyMM: string) => {
  if (!yyyyMM) return ''
  const [year, month] = yyyyMM.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  const format = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date)
  return format.charAt(0).toUpperCase() + format.slice(1)
}

export const getCurrentMonthStr = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Rango de fechas [inicio, fin] de un mes "YYYY-MM" en hora local (sin bug de zona horaria).
// El último día se calcula con new Date(year, month, 0) y se formatea manualmente para
// evitar el corrimiento de toISOString() en UTC-5.
export const getMonthDateRange = (yyyyMM: string) => {
  const [year, month] = yyyyMM.split('-').map(Number)
  const last = new Date(year, month, 0).getDate() // día del último día del mes
  const mm = String(month).padStart(2, '0')
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(last).padStart(2, '0')}`,
  }
}

// ─── Reparto de ingresos Liliana / Luisa ────────────────────────────────────
// Regla de negocio: el valor de un plan se reparte por sesión. Cada sesión que
// REALIZA Luisa (cita completada asignada a Luisa) le genera un 25% de comisión;
// el resto es ganancia de Liliana (dueña de la clínica). Liliana también se queda
// el 100% de las sesiones que ella misma realiza. El diezmo (10%) sale solo de la
// ganancia de Liliana; Luisa no diezma.

export interface PlanFinanzas {
  valor: number
  monto_pagado?: number
  duracion_minutos?: number
  citas?: { fisioterapeuta?: string | null; estado?: string | null }[]
}

export const esCitaCompletada = (estado?: string | null) => {
  const s = (estado || '').toLowerCase().trim()
  return s === 'completada' || s === 'completado'
}

// Nº de sesiones del plan: preferimos contar las citas reales; si no hay, caemos
// a duracion_minutos/60 (convención de creación del plan) y por último a 1.
export const getNumSesionesPlan = (plan: PlanFinanzas) => {
  const citas = plan.citas?.length || 0
  if (citas > 0) return citas
  if (plan.duracion_minutos && plan.duracion_minutos >= 60) return plan.duracion_minutos / 60
  return 1
}

export const getValorPorSesion = (plan: PlanFinanzas) => {
  return plan.valor / getNumSesionesPlan(plan)
}

// Comisión que le corresponde a Luisa por un plan: 25% del valor de las sesiones
// que ella realizó (citas completadas asignadas a Luisa).
export const calcularComisionLuisa = (plan: PlanFinanzas) => {
  const citas = plan.citas || []
  const sesionesLuisa = citas.filter(c => c.fisioterapeuta === 'Luisa' && esCitaCompletada(c.estado)).length
  if (sesionesLuisa === 0) return 0
  return Math.round(getValorPorSesion(plan) * sesionesLuisa * 0.25)
}

// Ganancia real de Liliana sobre lo RECAUDADO de un plan (recaudado − comisión Luisa).
// Se calcula sobre monto_pagado porque el diezmo/ganancia se computan sobre dinero
// efectivamente recibido, no proyectado. Nunca negativo.
export const calcularGananciaLiliana = (plan: PlanFinanzas) => {
  const recaudado = plan.monto_pagado || 0
  return Math.max(0, recaudado - calcularComisionLuisa(plan))
}

export const DIEZMO_PORCENTAJE = 0.1

export const calcularDiezmo = (gananciaLiliana: number) => Math.round(gananciaLiliana * DIEZMO_PORCENTAJE)
