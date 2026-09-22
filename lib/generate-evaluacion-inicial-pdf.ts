import jsPDF from 'jspdf'
import { ENTIDAD } from '@/lib/utils'
import { splitPatientName, type EvaluacionInicialForm } from '@/lib/evaluacion-inicial'

interface ProfesionalData {
  direccion?: string
  telefono?: string
  email?: string
}

interface FisioData {
  nombre_completo: string
  especialidad: string
  registro_profesional?: string
  firma?: { dataUrl: string; width: number; height: number } | null
}

const ROSE_950 = [76, 5, 25] as const
const ROSE_600 = [225, 29, 72] as const
const ROSE_100 = [255, 228, 230] as const
const ROSE_50 = [255, 241, 242] as const
const SLATE_800 = [30, 41, 59] as const
const SLATE_500 = [100, 116, 139] as const
const WHITE = [255, 255, 255] as const

export function generateEvaluacionInicialPDF(
  evaluacion: EvaluacionInicialForm,
  paciente: { nombre: string; telefono?: string },
  profesional: ProfesionalData,
  fisio: FisioData,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = 62

  const addHeader = () => {
    doc.setFillColor(...ROSE_950)
    doc.rect(0, 0, pageWidth, 48, 'F')
    doc.setTextColor(255, 205, 215)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(ENTIDAD.toUpperCase(), margin, 11)
    doc.setTextColor(...WHITE)
    doc.setFontSize(18)
    doc.text('Evaluación Inicial Fisioterapéutica', margin, 22)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 205, 215)
    doc.text('Clasificación del funcionamiento y discapacidad', margin, 30)
    doc.text(`${fisio.nombre_completo} · ${fisio.especialidad}`, margin, 38)
    if (fisio.registro_profesional) doc.text(`Registro profesional ${fisio.registro_profesional}`, margin, 43)

    const date = new Date(`${evaluacion.fecha_valoracion}T12:00:00`).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.text(date, pageWidth - margin, 11, { align: 'right' })
  }

  const addPage = () => {
    doc.addPage()
    addHeader()
    y = 58
  }

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 22) addPage()
  }

  const section = (number: number, title: string) => {
    ensureSpace(13)
    doc.setFillColor(...ROSE_50)
    doc.roundedRect(margin, y, contentWidth, 10, 2.5, 2.5, 'F')
    doc.setFillColor(...ROSE_600)
    doc.circle(margin + 6, y + 5, 3.4, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(String(number), margin + 6, y + 7, { align: 'center' })
    doc.setTextColor(...ROSE_950)
    doc.setFontSize(9)
    doc.text(title.toUpperCase(), margin + 13, y + 6.5)
    y += 14
  }

  const fieldGrid = (items: { label: string; value?: string }[], columns = 2) => {
    const gap = 3
    const width = (contentWidth - gap * (columns - 1)) / columns
    const rows = Math.ceil(items.length / columns)
    for (let row = 0; row < rows; row++) {
      const slice = items.slice(row * columns, row * columns + columns)
      const heights = slice.map(item => {
        const lines = doc.splitTextToSize(item.value || '—', width - 6)
        return Math.max(14, 9 + lines.length * 4)
      })
      const height = Math.max(...heights)
      ensureSpace(height + 3)
      slice.forEach((item, index) => {
        const x = margin + index * (width + gap)
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(...ROSE_100)
        doc.roundedRect(x, y, width, height, 2, 2, 'FD')
        doc.setTextColor(...SLATE_500)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.text(item.label.toUpperCase(), x + 3, y + 5)
        doc.setTextColor(...SLATE_800)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.text(doc.splitTextToSize(item.value || '—', width - 6), x + 3, y + 10)
      })
      y += height + 3
    }
  }

  const narrative = (label: string, value?: string) => {
    const lines = doc.splitTextToSize(value || 'Sin información registrada.', contentWidth - 8)
    const height = Math.max(20, 12 + lines.length * 4.2)
    ensureSpace(height + 3)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...ROSE_100)
    doc.roundedRect(margin, y, contentWidth, height, 2.5, 2.5, 'FD')
    doc.setTextColor(...ROSE_600)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(label.toUpperCase(), margin + 4, y + 6)
    doc.setTextColor(...SLATE_800)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(lines, margin + 4, y + 12)
    y += height + 3
  }

  addHeader()

  section(1, 'Datos del paciente')
  fieldGrid([
    { label: 'Primer apellido', value: evaluacion.primer_apellido },
    { label: 'Segundo apellido', value: evaluacion.segundo_apellido },
    { label: 'Primer nombre', value: evaluacion.primer_nombre },
    { label: 'Segundo nombre', value: evaluacion.segundo_nombre },
    { label: 'Edad', value: evaluacion.edad ? `${evaluacion.edad} años` : '' },
    { label: 'Identificación o pasaporte', value: evaluacion.documento_identidad },
    { label: 'Sexo', value: evaluacion.sexo },
    { label: 'Teléfono', value: paciente.telefono },
  ])

  section(2, 'Toma de signos vitales')
  fieldGrid([
    { label: 'FR (Frecuencia respiratoria)', value: evaluacion.fr },
    { label: 'FC (Frecuencia cardíaca)', value: evaluacion.fc },
    { label: 'TA (Tensión arterial)', value: evaluacion.ta },
    { label: 'Auscultación', value: evaluacion.auscultacion },
  ], 2)

  section(3, 'Discapacidad y clasificación')
  fieldGrid([
    { label: 'Función mental intelectual o psicológica', value: evaluacion.funcion_mental },
    { label: 'Función sensorial auditiva visual voz y habla', value: evaluacion.funcion_sensorial },
    { label: 'Función neuromusculoesquelética y movimiento', value: evaluacion.funcion_neuromusculoesqueletica },
    { label: 'Actividad de aprendizaje', value: evaluacion.actividad_aprendizaje },
    { label: 'Aplicación del conocimiento', value: evaluacion.actividad_conocimiento },
    { label: 'Movilidad y relaciones interpersonales', value: evaluacion.actividad_movilidad_relaciones },
  ])

  const nameParts = splitPatientName(fisio.nombre_completo)
  const primerNombre = evaluacion.medico_primer_nombre || nameParts.primer_nombre || ''
  const segundoNombre = evaluacion.medico_segundo_nombre || nameParts.segundo_nombre || ''
  const primerApellido = evaluacion.medico_primer_apellido || nameParts.primer_apellido || ''
  const segundoApellido = evaluacion.medico_segundo_apellido || nameParts.segundo_apellido || ''
  const identificacion = evaluacion.medico_identificacion || fisio.registro_profesional || ''
  const tipoEmpleado = evaluacion.tipo_empleado || 'Fisioterapeuta'

  section(4, 'Datos del profesional')
  fieldGrid([
    { label: 'Primer apellido', value: primerApellido },
    { label: 'Segundo apellido', value: segundoApellido },
    { label: 'Primer nombre', value: primerNombre },
    { label: 'Segundo nombre', value: segundoNombre },
    { label: 'Número de identidad', value: identificacion },
    { label: 'Tipo de empleado', value: tipoEmpleado },
    { label: 'Organismo que elabora', value: ENTIDAD },
  ])

  section(5, 'Descripción clínica')
  narrative('Descripción de la enfermedad y o discapacidad', evaluacion.descripcion_enfermedad_discapacidad)
  narrative('Objetivo', evaluacion.objetivo)
  narrative('Detalle de la visita', evaluacion.detalle_visita)
  narrative('Plan de tratamiento', evaluacion.plan_tratamiento)

  section(6, 'Firmas')
  ensureSpace(48)
  const signatureY = y + 19
  if (fisio.firma) {
    const ratio = fisio.firma.width > 0 && fisio.firma.height > 0 ? fisio.firma.width / fisio.firma.height : 3
    let drawW = 58
    let drawH = drawW / ratio
    if (drawH > 15) { drawH = 15; drawW = drawH * ratio }
    doc.addImage(fisio.firma.dataUrl, 'PNG', margin + 7, signatureY - drawH - 1, drawW, drawH)
  }
  doc.setDrawColor(...SLATE_500)
  doc.line(margin + 5, signatureY, margin + 78, signatureY)
  doc.line(pageWidth / 2 + 4, signatureY, pageWidth - margin - 5, signatureY)
  doc.setTextColor(...SLATE_800)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(fisio.nombre_completo, margin + 5, signatureY + 6)
  doc.text('Paciente o cuidador', pageWidth / 2 + 4, signatureY + 6)
  doc.setTextColor(...SLATE_500)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Registro ${fisio.registro_profesional || '—'}`, margin + 5, signatureY + 11)
  doc.text(paciente.nombre, pageWidth / 2 + 4, signatureY + 11)
  y = signatureY + 18

  if (profesional.direccion || profesional.telefono || profesional.email) {
    ensureSpace(12)
    doc.setTextColor(...SLATE_500)
    doc.setFontSize(7)
    doc.text([profesional.direccion, profesional.telefono, profesional.email].filter(Boolean).join(' · '), margin, y)
  }

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.setDrawColor(...ROSE_100)
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...SLATE_500)
    doc.text(`${ENTIDAD} · Evaluación inicial`, margin, pageHeight - 8)
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  const safeName = paciente.nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, '_')
  doc.save(`Evaluacion_Inicial_${safeName}_${evaluacion.fecha_valoracion}.pdf`)
}
