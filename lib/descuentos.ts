export const SERVICIOS_CUPON = [
  { id: 'evaluacion', label: 'Valoración' },
  { id: 'descarga-muscular', label: 'Descarga muscular' },
  { id: 'fisioterapia', label: 'Fisioterapia y paquetes de sesiones' },
  { id: 'recovery-premium', label: 'Recovery Premium' },
  { id: 'recovery-star', label: 'Recovery Star (5 sesiones)' },
  { id: 'recovery-balance', label: 'Recovery Balance (10 sesiones)' },
  { id: 'personalizado', label: 'Plan personalizado' },
] as const

export type ServicioCupon = typeof SERVICIOS_CUPON[number]['id']

export function aplicarDescuento(precio: number, porcentaje: number, valoracionGratis = false) {
  if (valoracionGratis) return 0
  const porcentajeSeguro = Math.min(100, Math.max(0, porcentaje))
  return Math.round(precio * (1 - porcentajeSeguro / 100))
}
