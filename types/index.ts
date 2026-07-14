// types/index.ts — tipos globales de FisioGestión

export type EstadoPaciente = 'activo' | 'en_pausa' | 'alta_medica'
export type MetodoPago = 'efectivo' | 'transferencia' | 'otro'
export type EstadoPago = 'pagado' | 'pendiente'
export type EstadoCita = 'confirmada' | 'pendiente' | 'cancelada' | 'completada'
export type Fisioterapeuta = 'Liliana' | 'Luisa'
export type PagoTerapeuta = 'pagado' | 'pendiente'

export interface Paciente {
  id: string
  nombre: string
  telefono?: string
  diagnostico?: string
  valor_sesion: number
  estado: EstadoPaciente
  notas_iniciales?: string
  created_at: string
  total_sesiones?: number
  edad?: number
  documento_identidad?: string
  sexo?: string
  fecha_nacimiento?: string
  fisioterapeuta?: Fisioterapeuta
}

// "Sesion" es en realidad el PLAN de tratamiento: agrupa N citas. duracion_minutos
// codifica el nº de sesiones del plan (60 min c/u) para repartir el valor.
export interface Sesion {
  id: string
  paciente_id: string
  paciente?: Paciente
  fecha: string
  duracion_minutos: number
  valor: number
  metodo_pago?: MetodoPago
  estado_pago: EstadoPago
  nota_clinica?: string
  created_at: string
  monto_pagado?: number
  diezmo_entregado?: boolean
}

export interface Pago {
  id: string
  paciente_id: string
  paciente?: Paciente
  sesion_id?: string
  monto: number
  metodo: MetodoPago
  fecha: string
  created_at: string
}

export interface Cita {
  id: string
  paciente_id: string
  paciente?: Paciente
  sesion_id?: string      // FK al plan (sesiones)
  fecha: string           // ISO date string YYYY-MM-DD
  hora_inicio: string     // HH:mm
  duracion_minutos: number
  estado: EstadoCita
  notas?: string
  created_at: string
  fisioterapeuta: Fisioterapeuta
  pago_terapeuta_control?: PagoTerapeuta
  notificado_1h?: boolean
  notificado_10m?: boolean
}

export interface Diezmo {
  id: string
  mes: number             // 1-12
  anio: number
  ingreso_mes: number
  monto_diezmo: number    // ingreso_mes * 0.10
  entregado: boolean
  fecha_entrega?: string
  created_at: string
}

// Resumen calculado para el dashboard
export interface ResumenDashboard {
  pacientes_activos: number
  citas_hoy: number
  por_cobrar: number
  ingreso_mes: number
  diezmo_mes: number
  diezmo_entregado: boolean
}
