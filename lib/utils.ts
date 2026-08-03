import type { Fisioterapeuta } from '@/types'

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

// ─── Reparto de ingresos entre la dueña y las fisioterapeutas ───────────────
// Regla de negocio: el valor de un plan se reparte por sesión. Cada sesión que
// REALIZA una empleada (cita completada asignada a ella) le genera un 25% de
// comisión, o un 30% si fue ella quien trajo al paciente. El resto es ganancia de
// Liliana (dueña de la clínica), que además se queda el 100% de las sesiones que
// ella misma realiza. El diezmo (10%) sale solo de la ganancia de Liliana; las
// empleadas no diezman.

export const FISIOTERAPEUTAS: Fisioterapeuta[] = ['Liliana', 'Luisa', 'Jeniffer']
// Liliana es la dueña: lo que ella atiende es ganancia, no comisión.
export const DUENA: Fisioterapeuta = 'Liliana'
export const EMPLEADAS = FISIOTERAPEUTAS.filter(f => f !== DUENA)
export const COMISION_BASE = 0.25
export const COMISION_REFERIDO = 0.30

// Quién está usando la app. Antes esto era un booleano `isLuisa` repetido en una
// docena de pantallas; con tres fisioterapeutas hace falta saber CUÁL es, no solo
// si es la dueña o no (si no, Jeniffer entraría identificada como Liliana).
export const getFisioDeEmail = (email?: string | null): Fisioterapeuta => {
  const correo = (email || '').toLowerCase()
  return FISIOTERAPEUTAS.find(f => correo.includes(f.toLowerCase())) ?? DUENA
}

export const esDuena = (fisio?: Fisioterapeuta | null) => fisio === DUENA

export interface PacienteFinanzas {
  fisioterapeuta?: string | null
  traido_por_fisio?: boolean | null
}

export interface PlanFinanzas {
  valor: number
  monto_pagado?: number
  monto_diezmado?: number
  duracion_minutos?: number
  cortesia?: boolean
  citas?: { fisioterapeuta?: string | null; estado?: string | null; fecha?: string | null; hora_inicio?: string | null }[]
  // Viene del join de Supabase: `pacientes(fisioterapeuta, traido_por_fisio)`.
  // En runtime es un objeto (la relación es muchos-a-uno), pero supabase-js infiere
  // el tipo como array, así que aceptamos ambas formas y normalizamos.
  pacientes?: PacienteFinanzas | PacienteFinanzas[] | null
  paciente?: PacienteFinanzas | PacienteFinanzas[] | null
}

const getPaciente = (plan: PlanFinanzas): PacienteFinanzas | null => {
  const bruto = plan.pacientes ?? plan.paciente ?? null
  if (!bruto) return null
  return Array.isArray(bruto) ? (bruto[0] ?? null) : bruto
}

// 30% solo para la fisio que trajo al paciente; 25% para el resto de empleadas.
export const getTasaComision = (
  fisio?: string | null,
  paciente?: PacienteFinanzas | null
) => {
  if (!fisio || fisio === DUENA) return 0
  const loTrajoElla = !!paciente?.traido_por_fisio && paciente?.fisioterapeuta === fisio
  return loTrajoElla ? COMISION_REFERIDO : COMISION_BASE
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

// Recaudo de esta sesión/plan que aún NO ha sido diezmado
export const getRecaudoPendienteDiezmo = (plan: PlanFinanzas) => {
  const pagado = plan.monto_pagado || 0
  const diezmado = plan.monto_diezmado || 0
  return Math.max(0, pagado - diezmado)
}

// Comisión que le corresponde a cada empleada por un plan: su tasa sobre el valor
// de las sesiones que ella realizó (citas completadas asignadas a ella), pero SOLO
// sobre dinero efectivamente pagado. Nadie cobra por trabajo que el paciente aún no
// ha pagado, así que la base se limita a lo recaudado: min(valor trabajado, pagado).
// `base` permite calcular sobre el total pagado o solo sobre el recaudo aún no
// diezmado, que es lo único que cambia entre los dos usos.
const calcularComisionesConBase = (plan: PlanFinanzas, recaudo: number) => {
  const paciente = getPaciente(plan)
  const valorPorSesion = getValorPorSesion(plan)

  // El recaudo se reparte sesión por sesión en ORDEN CRONOLÓGICO: si el paciente
  // no ha pagado todo el plan, las últimas sesiones quedan sin cubrir y esa
  // comisión aún no se debe. Ordenar importa porque ahora las tasas difieren
  // (25% / 30%): repartir en el orden del array daría un resultado distinto según
  // cómo viniera la consulta. Es el mismo criterio que usa la pantalla de Finanzas
  // para liquidar, así que ambas cuadran.
  const completadas = (plan.citas || [])
    .filter(c => esCitaCompletada(c.estado) && c.fisioterapeuta && c.fisioterapeuta !== DUENA)
    .slice()
    .sort((a, b) =>
      `${a.fecha ?? ''}${a.hora_inicio ?? ''}`.localeCompare(`${b.fecha ?? ''}${b.hora_inicio ?? ''}`))

  const porFisio: Record<string, number> = {}
  let restante = recaudo
  for (const cita of completadas) {
    const fisio = cita.fisioterapeuta as string
    const base = plan.cortesia ? valorPorSesion : Math.max(0, Math.min(valorPorSesion, restante))
    if (!plan.cortesia) restante -= base
    if (base <= 0) continue
    porFisio[fisio] = (porFisio[fisio] || 0) + Math.round(base * getTasaComision(fisio, paciente))
  }
  return porFisio
}

// Comisión de cada empleada sobre lo recaudado del plan
export const calcularComisionesFisios = (plan: PlanFinanzas) =>
  calcularComisionesConBase(plan, plan.monto_pagado || 0)

export const calcularComisionTotal = (plan: PlanFinanzas) =>
  Object.values(calcularComisionesFisios(plan)).reduce((a, b) => a + b, 0)

// Comisiones correspondientes de manera proporcional al recaudo pendiente de diezmo
export const calcularComisionesFisiosPendienteDiezmo = (plan: PlanFinanzas) =>
  calcularComisionesConBase(plan, getRecaudoPendienteDiezmo(plan))

export const calcularComisionTotalPendienteDiezmo = (plan: PlanFinanzas) =>
  Object.values(calcularComisionesFisiosPendienteDiezmo(plan)).reduce((a, b) => a + b, 0)

// Ganancia real de Liliana sobre lo RECAUDADO de un plan (recaudado − comisiones).
// Se calcula sobre monto_pagado porque el diezmo/ganancia se computan sobre dinero
// efectivamente recibido, no proyectado. Nunca negativo.
export const calcularGananciaLiliana = (plan: PlanFinanzas) => {
  const recaudado = plan.monto_pagado || 0
  return Math.max(0, recaudado - calcularComisionTotal(plan))
}

// Ganancia real de Liliana sobre el recaudo PENDIENTE DE DIEZMO de un plan
export const calcularGananciaLilianaPendienteDiezmo = (plan: PlanFinanzas) => {
  const recaudoPendiente = getRecaudoPendienteDiezmo(plan)
  return Math.max(0, recaudoPendiente - calcularComisionTotalPendienteDiezmo(plan))
}

export const DIEZMO_PORCENTAJE = 0.1

export const calcularDiezmo = (gananciaLiliana: number) => Math.round(gananciaLiliana * DIEZMO_PORCENTAJE)
