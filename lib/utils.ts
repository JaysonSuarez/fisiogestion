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
