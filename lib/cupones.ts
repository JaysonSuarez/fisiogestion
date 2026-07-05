import { getSupabaseEncuesta } from './supabaseEncuesta'

// Lógica compartida de cupones de Liliana's Therapy (viven en el Supabase de la encuesta).

export type EstadoCupon = 'valido' | 'expirado' | 'usado' | 'no_encontrado'

export type ResultadoCupon = {
  estado: EstadoCupon
  nombre?: string
  objetivo?: string
  fecha_expiracion?: string
  codigo_cupon?: string
}

// Porcentaje de descuento del cupón en planes de tratamiento (la valoración es gratis).
export const DESCUENTO_CUPON = 0.10

// Consulta el cupón y determina su estado (sin modificarlo).
export async function validarCupon(codigo: string): Promise<ResultadoCupon> {
  const codigoLimpio = codigo.trim().toUpperCase()
  if (!codigoLimpio) return { estado: 'no_encontrado' }

  const { data, error } = await getSupabaseEncuesta()
    .from('encuestas_fisioterapia')
    .select('codigo_cupon, cupon_usado, nombre, objetivo, fecha_expiracion')
    .eq('codigo_cupon', codigoLimpio)
    .single()

  if (error || !data) return { estado: 'no_encontrado' }

  const base = {
    nombre: data.nombre,
    objetivo: data.objetivo,
    fecha_expiracion: data.fecha_expiracion,
    codigo_cupon: data.codigo_cupon,
  }
  if (data.cupon_usado) return { estado: 'usado', ...base }
  if (new Date(data.fecha_expiracion) < new Date()) return { estado: 'expirado', ...base }
  return { estado: 'valido', ...base }
}

// Marca el cupón como usado de forma atómica (solo si aún NO estaba usado).
// Devuelve true si logró reclamarlo; false si ya estaba usado o hubo un error.
// Esto garantiza que un cupón solo se puede reclamar una vez.
export async function reclamarCupon(codigo: string): Promise<boolean> {
  const codigoLimpio = codigo.trim().toUpperCase()
  if (!codigoLimpio) return false

  const { data, error } = await getSupabaseEncuesta()
    .from('encuestas_fisioterapia')
    .update({ cupon_usado: true })
    .eq('codigo_cupon', codigoLimpio)
    .eq('cupon_usado', false)
    .select('codigo_cupon')

  return !error && !!data && data.length > 0
}

// Aplica la regla de descuento: la valoración queda gratis; los demás planes reciben 10%.
export function aplicarDescuentoCupon(precio: number, esValoracion: boolean): number {
  if (esValoracion) return 0
  return Math.round(precio * (1 - DESCUENTO_CUPON))
}
