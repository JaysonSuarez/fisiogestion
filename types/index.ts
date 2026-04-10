// types/index.ts — tipos globales de FisioGestión

export type EstadoPaciente = 'activo' | 'en_pausa' | 'alta_medica'
export type MetodoPago = 'efectivo' | 'transferencia' | 'otro'
export type EstadoPago = 'pagado' | 'pendiente'
export type EstadoCita = 'confirmada' | 'pendiente' | 'cancelada' | 'completada'

export interface Paciente {
  id: string
  nombre: string
  telefono?: string
  diagnostico?: string
  valor_sesion: number
  estado: EstadoPaciente
  notas_iniciales?: string
  created_at: string
}

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
  fecha: string           // ISO date string YYYY-MM-DD
  hora_inicio: string     // HH:mm
  duracion_minutos: number
  estado: EstadoCita
  notas?: string
  created_at: string
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
