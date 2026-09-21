export interface EvaluacionInicialForm {
  fecha_valoracion: string
  primer_apellido: string
  segundo_apellido: string
  primer_nombre: string
  segundo_nombre: string
  edad: string
  documento_identidad: string
  fecha_nacimiento: string
  sexo: string
  estado_civil: string
  municipio: string
  vereda_sector: string
  referencia_vivienda: string
  funcion_mental: string
  funcion_sensorial: string
  funcion_neuromusculoesqueletica: string
  actividad_aprendizaje: string
  actividad_conocimiento: string
  actividad_movilidad_relaciones: string
  medico_primer_apellido: string
  medico_segundo_apellido: string
  medico_primer_nombre: string
  medico_segundo_nombre: string
  medico_identificacion: string
  tipo_empleado: string
  organismo_elaborador: string
  descripcion_enfermedad_discapacidad: string
  objetivo: string
  detalle_visita: string
  plan_tratamiento: string
}

export const CLASIFICACIONES_FUNCIONALES = [
  { value: 'No aplica', label: 'No aplica' },
  { value: 'Leve', label: 'Leve' },
  { value: 'Moderada', label: 'Moderada' },
  { value: 'Grave', label: 'Grave' },
  { value: 'Completa', label: 'Completa' },
  { value: 'No especificada', label: 'No especificada' },
]

export function createEmptyEvaluacionInicial(): EvaluacionInicialForm {
  return {
    fecha_valoracion: new Date().toISOString().split('T')[0],
    primer_apellido: '',
    segundo_apellido: '',
    primer_nombre: '',
    segundo_nombre: '',
    edad: '',
    documento_identidad: '',
    fecha_nacimiento: '',
    sexo: '',
    estado_civil: '',
    municipio: '',
    vereda_sector: '',
    referencia_vivienda: '',
    funcion_mental: 'No aplica',
    funcion_sensorial: 'No aplica',
    funcion_neuromusculoesqueletica: 'No aplica',
    actividad_aprendizaje: 'No aplica',
    actividad_conocimiento: 'No aplica',
    actividad_movilidad_relaciones: 'No aplica',
    medico_primer_apellido: '',
    medico_segundo_apellido: '',
    medico_primer_nombre: '',
    medico_segundo_nombre: '',
    medico_identificacion: '',
    tipo_empleado: '',
    organismo_elaborador: '',
    descripcion_enfermedad_discapacidad: '',
    objetivo: '',
    detalle_visita: '',
    plan_tratamiento: '',
  }
}

export function splitPatientName(nombre?: string | null) {
  const parts = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { primer_nombre: parts[0] }
  if (parts.length === 2) return { primer_nombre: parts[0], primer_apellido: parts[1] }
  if (parts.length === 3) {
    return { primer_nombre: parts[0], primer_apellido: parts[1], segundo_apellido: parts[2] }
  }
  return {
    primer_nombre: parts[0],
    segundo_nombre: parts.slice(1, -2).join(' '),
    primer_apellido: parts.at(-2) || '',
    segundo_apellido: parts.at(-1) || '',
  }
}
