import { validarCuponAction, reclamarCuponAction, type EstadoCupon, type ResultadoCupon } from './actions/cupones'

export type { EstadoCupon, ResultadoCupon }

// Porcentaje de descuento del cupón en planes de tratamiento (la valoración es gratis).
export const DESCUENTO_CUPON = 0.10

// Consulta el cupón y determina su estado (sin modificarlo).
export async function validarCupon(codigo: string): Promise<ResultadoCupon> {
  return await validarCuponAction(codigo)
}

// Marca el cupón como usado de forma atómica (solo si aún NO estaba usado).
// Devuelve true si logró reclamarlo; false si ya estaba usado o hubo un error.
// Esto garantiza que un cupón solo se puede reclamar una vez.
export async function reclamarCupon(codigo: string): Promise<boolean> {
  return await reclamarCuponAction(codigo)
}

// Aplica la regla de descuento: la valoración queda gratis; los demás planes reciben 10%.
export function aplicarDescuentoCupon(precio: number, esValoracion: boolean): number {
  if (esValoracion) return 0
  return Math.round(precio * (1 - DESCUENTO_CUPON))
}
