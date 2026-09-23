'use server'

import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type EstadoCupon = 'valido' | 'no_aplica' | 'error_configuracion' | 'expirado' | 'usado' | 'no_encontrado'

export type ResultadoCupon = {
  estado: EstadoCupon
  nombre?: string
  objetivo?: string
  fecha_expiracion?: string
  codigo_cupon?: string
  porcentaje_descuento?: number
  regla_configurada?: boolean
  servicios_aplicables?: string[]
}

// Cliente de Supabase en el servidor para evitar problemas de CORS desde el navegador
const supabase = createClient(
  process.env.NEXT_PUBLIC_ENCUESTA_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_ENCUESTA_SUPABASE_ANON_KEY!
)

export async function validarCuponAction(codigo: string, servicio: string): Promise<ResultadoCupon> {
  const codigoLimpio = codigo.trim().toUpperCase()
  if (!codigoLimpio) return { estado: 'no_encontrado' }

  const { data, error } = await supabase
    .from('encuestas_fisioterapia')
    .select('codigo_cupon, cupon_usado, nombre, objetivo, fecha_expiracion')
    .eq('codigo_cupon', codigoLimpio)
    .single()

  if (error || !data) {
    console.error("Error al validar cupón en el servidor:", error)
    return { estado: 'no_encontrado' }
  }

  const base = {
    nombre: data.nombre,
    objetivo: data.objetivo,
    fecha_expiracion: data.fecha_expiracion,
    codigo_cupon: data.codigo_cupon,
  }
  if (data.cupon_usado) return { estado: 'usado', ...base }
  if (new Date(data.fecha_expiracion) < new Date()) return { estado: 'expirado', ...base }

  const { data: regla, error: reglaError } = await getSupabaseAdmin()
    .from('reglas_cupones')
    .select('porcentaje_descuento,servicios_aplicables')
    .eq('codigo_cupon', codigoLimpio)
    .maybeSingle()

  if (reglaError) {
    console.error('Error al consultar la regla del cupón:', reglaError)
    return { estado: 'error_configuracion', ...base }
  }
  if (regla) {
    const servicios = regla.servicios_aplicables as string[] | null
    if (servicios?.length && servicio && !servicios.includes(servicio)) {
      return { estado: 'no_aplica', ...base, porcentaje_descuento: regla.porcentaje_descuento, regla_configurada: true, servicios_aplicables: servicios }
    }
    return { estado: 'valido', ...base, porcentaje_descuento: regla.porcentaje_descuento, regla_configurada: true, servicios_aplicables: servicios || [] }
  }

  // Conserva el descuento histórico para códigos sin una regla configurada.
  return { estado: 'valido', ...base, porcentaje_descuento: 10, regla_configurada: false }
}

export async function reclamarCuponAction(codigo: string): Promise<boolean> {
  const codigoLimpio = codigo.trim().toUpperCase()
  if (!codigoLimpio) return false

  const { data, error } = await supabase
    .from('encuestas_fisioterapia')
    .update({ cupon_usado: true })
    .eq('codigo_cupon', codigoLimpio)
    .eq('cupon_usado', false)
    .select('codigo_cupon')

  if (error) {
    console.error("Error al reclamar cupón en el servidor:", error)
  }

  return !error && !!data && data.length > 0
}
