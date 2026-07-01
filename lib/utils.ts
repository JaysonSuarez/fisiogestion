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

export const getMesesDisponibles = () => {
  const meses = []
  const start = new Date(2024, 0, 1)
  const end = new Date()
  
  // En caso de que estemos antes de 2024, garantizamos que al menos esté el mes actual
  if (end < start) {
      return [getCurrentMonthStr()]
  }
  
  while (start <= end) {
    const year = start.getFullYear()
    const month = String(start.getMonth() + 1).padStart(2, '0')
    meses.push(`${year}-${month}`)
    start.setMonth(start.getMonth() + 1)
  }
  return meses.reverse()
}

export const formatMes = (yyyyMM: string) => {
  if (!yyyyMM) return ''
  const [year, month] = yyyyMM.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  const format = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date)
  return format.charAt(0).toUpperCase() + format.slice(1)
}

export const getCurrentMonthStr = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
