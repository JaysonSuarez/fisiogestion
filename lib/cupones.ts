import { validarCuponAction, reclamarCuponAction, type EstadoCupon, type ResultadoCupon } from './actions/cupones'

export type { EstadoCupon, ResultadoCupon }

// Porcentaje histórico usado para cupones que aún no tienen una regla en Fisiogestión.
export const DESCUENTO_CUPON = 10

// Consulta el cupón y determina su estado (sin modificarlo).
export async function validarCupon(codigo: string, servicio = '', sesiones?: number): Promise<ResultadoCupon> {
  return await validarCuponAction(codigo, servicio, sesiones)
}

// Marca el cupón como usado de forma atómica (solo si aún NO estaba usado).
// Devuelve true si logró reclamarlo; false si ya estaba usado o hubo un error.
// Esto garantiza que un cupón solo se puede reclamar una vez.
export async function reclamarCupon(codigo: string): Promise<boolean> {
  return await reclamarCuponAction(codigo)
}

// Respeta las reglas configuradas y conserva el beneficio histórico en códigos no configurados.
export function aplicarDescuentoCupon(precio: number, resultado: ResultadoCupon | null, esValoracion: boolean): number {
  if (!resultado || resultado.estado !== 'valido') return precio
  if (esValoracion && !resultado.regla_configurada) return 0
  const porcentaje = resultado.porcentaje_descuento ?? DESCUENTO_CUPON
  return Math.round(precio * (1 - porcentaje / 100))
}
