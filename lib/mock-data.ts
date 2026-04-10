// lib/mock-data.ts — datos de ejemplo para desarrollo local
// Cuando conectes Supabase, reemplaza las funciones de cada página
// para que lean de la base de datos real en lugar de estos mocks.

import { Paciente, Sesion, Cita, Diezmo, ResumenDashboard } from '@/types'

export const PACIENTES: Paciente[] = []
export const SESIONES: Sesion[] = []
export const CITAS: Cita[] = []
export const DIEZMOS: Diezmo[] = []

export const RESUMEN_DASHBOARD: ResumenDashboard = {
  pacientes_activos: 0,
  citas_hoy: 0,
  por_cobrar: 0,
  ingreso_mes: 0,
  diezmo_mes: 0,
  diezmo_entregado: false,
}

// Helpers
export function getPaciente(id: string) {
  return PACIENTES.find(p => p.id === id)
}

export function getSesionesPorPaciente(paciente_id: string) {
  return SESIONES.filter(s => s.paciente_id === paciente_id)
}

export function getDeudaPaciente(paciente_id: string): number {
  return getSesionesPorPaciente(paciente_id)
    .filter(s => s.estado_pago === 'pendiente')
    .reduce((acc, s) => acc + s.valor, 0)
}

export function getTotalPagadoPaciente(paciente_id: string): number {
  return getSesionesPorPaciente(paciente_id)
    .filter(s => s.estado_pago === 'pagado')
    .reduce((acc, s) => acc + s.valor, 0)
}

export function getCitasDelDia(fecha: string) {
  return CITAS.filter(c => c.fecha === fecha)
}

export function formatCOP(valor: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

export function getIniciales(nombre: string): string {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}
