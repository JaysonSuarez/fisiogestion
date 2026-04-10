import jsPDF from 'jspdf'

interface EvaluacionData {
  // Paciente
  nombre: string
  edad?: number
  sexo?: string
  documento_identidad?: string
  fecha_valoracion: string
  ocupacion?: string
  telefono?: string

  // Motivo
  motivo_consulta?: string

  // Anamnesis
  inicio_problema?: string
  mecanismo_lesion?: string
  escala_eva?: number
  factores_empeoran?: string
  factores_alivian?: string
  antecedentes_medicos?: string

  // Postural
  postura_estatica?: string
  alteraciones_visibles?: string
  analisis_marcha?: string

  // Movimiento
  rango_movimiento?: string
  limitaciones_movimiento?: string
  dolor_movimiento?: string

  // Muscular
  fuerza_muscular?: string
  tono_muscular?: string
  desequilibrios?: string

  // Pruebas
  test_ortopedicos?: string
  evaluacion_neurologica?: string
  pruebas_funcionales?: string

  // Resultados
  hallazgos?: string

  // Diagnóstico
  diagnostico_fisio?: string

  // Objetivos
  objetivos_corto_plazo?: string
  objetivos_mediano_plazo?: string
  objetivos_largo_plazo?: string

  // Plan
  tipo_intervencion?: string
  frecuencia_tratamiento?: string

  // Recomendaciones
  ejercicios_casa?: string
  cambios_posturales?: string
  actividades_evitar?: string
}

interface ProfesionalData {
  nombre_completo: string
  registro_profesional: string
  especialidad: string
  telefono: string
  email: string
  direccion: string
}

// Colors
const ROSE_950 = [40, 5, 15]
const ROSE_600 = [225, 29, 72]
const ROSE_100 = [255, 228, 230]
const ROSE_50 = [255, 241, 242]
const SLATE_700 = [51, 65, 85]
const SLATE_400 = [148, 163, 184]
const WHITE = [255, 255, 255]

export function generateEvaluacionPDF(
  evaluacion: EvaluacionData,
  profesional: ProfesionalData
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = 0

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - 30) {
      doc.addPage()
      y = 20
      drawPageFooter()
    }
  }

  function drawPageFooter() {
    const pageCount = doc.getNumberOfPages()
    doc.setFontSize(7)
    doc.setTextColor(...SLATE_400 as [number, number, number])
    doc.text(`Página ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    doc.text('FisioGestión — Documento generado digitalmente', pageWidth / 2, pageHeight - 6, { align: 'center' })
  }

  function drawSectionHeader(title: string, number: number) {
    checkPageBreak(18)
    // Rose accent bar
    doc.setFillColor(...ROSE_600 as [number, number, number])
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE as [number, number, number])
    doc.setFont('helvetica', 'bold')
    doc.text(`${number}. ${title.toUpperCase()}`, margin + 5, y + 7)
    y += 14
  }

  function drawField(label: string, value?: string | number | null) {
    if (value === undefined || value === null || value === '') return
    checkPageBreak(12)
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_400 as [number, number, number])
    doc.setFont('helvetica', 'bold')
    doc.text(label.toUpperCase(), margin + 2, y)
    y += 4

    doc.setFontSize(9)
    doc.setTextColor(...SLATE_700 as [number, number, number])
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(String(value), contentWidth - 4)
    doc.text(lines, margin + 2, y)
    y += lines.length * 4.5 + 3
  }

  function drawFieldRow(fields: { label: string; value?: string | number | null }[]) {
    const filledFields = fields.filter(f => f.value !== undefined && f.value !== null && f.value !== '')
    if (filledFields.length === 0) return
    checkPageBreak(12)

    const colWidth = contentWidth / filledFields.length
    filledFields.forEach((field, i) => {
      const x = margin + i * colWidth + 2
      doc.setFontSize(7.5)
      doc.setTextColor(...SLATE_400 as [number, number, number])
      doc.setFont('helvetica', 'bold')
      doc.text(field.label.toUpperCase(), x, y)

      doc.setFontSize(9)
      doc.setTextColor(...SLATE_700 as [number, number, number])
      doc.setFont('helvetica', 'normal')
      doc.text(String(field.value), x, y + 4.5)
    })
    y += 12
  }

  function drawDivider() {
    checkPageBreak(6)
    doc.setDrawColor(...ROSE_100 as [number, number, number])
    doc.setLineWidth(0.3)
    doc.line(margin, y, margin + contentWidth, y)
    y += 4
  }

  function drawEVAScale(value: number) {
    checkPageBreak(18)
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE_400 as [number, number, number])
    doc.setFont('helvetica', 'bold')
    doc.text('ESCALA EVA (DOLOR)', margin + 2, y)
    y += 5

    const scaleWidth = contentWidth - 4
    const boxW = scaleWidth / 11
    for (let i = 0; i <= 10; i++) {
      const x = margin + 2 + i * boxW
      // Color gradient: green (0) → yellow (5) → red (10)
      const r = Math.min(255, Math.round(i * 25.5))
      const g = Math.max(0, Math.round(255 - i * 25.5))
      if (i === value) {
        doc.setFillColor(r, g, 0)
        doc.roundedRect(x, y, boxW - 1, 8, 1, 1, 'F')
        doc.setTextColor(255, 255, 255)
      } else {
        doc.setFillColor(245, 245, 245)
        doc.roundedRect(x, y, boxW - 1, 8, 1, 1, 'F')
        doc.setTextColor(150, 150, 150)
      }
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(String(i), x + boxW / 2 - 1, y + 5.5)
    }
    y += 14
  }

  // ═══════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════
  doc.setFillColor(...ROSE_950 as [number, number, number])
  doc.rect(0, 0, pageWidth, 45, 'F')

  // Title
  doc.setTextColor(...WHITE as [number, number, number])
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Evaluación Fisioterapéutica', margin, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 200, 210)
  doc.text(`${profesional.nombre_completo} — ${profesional.especialidad}`, margin, 28)
  if (profesional.registro_profesional) {
    doc.text(`Registro: ${profesional.registro_profesional}`, margin, 34)
  }
  if (profesional.direccion) {
    doc.text(profesional.direccion, margin, 40)
  }

  // Date on right
  doc.setTextColor(...WHITE as [number, number, number])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const dateStr = new Date(evaluacion.fecha_valoracion + 'T12:00').toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  doc.text(dateStr, pageWidth - margin, 20, { align: 'right' })

  y = 55

  // ═══════════════════════════════════════════════════════════
  // 1. DATOS DEL PACIENTE
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Datos del Paciente', 1)
  drawFieldRow([
    { label: 'Nombre completo', value: evaluacion.nombre },
    { label: 'Edad', value: evaluacion.edad ? `${evaluacion.edad} años` : undefined },
    { label: 'Sexo', value: evaluacion.sexo },
  ])
  drawFieldRow([
    { label: 'Documento de identidad', value: evaluacion.documento_identidad },
    { label: 'Ocupación', value: evaluacion.ocupacion },
    { label: 'Teléfono', value: evaluacion.telefono },
  ])
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 2. MOTIVO DE CONSULTA
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Motivo de Consulta', 2)
  drawField('¿Por qué viene el paciente?', evaluacion.motivo_consulta)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 3. ANAMNESIS (HISTORIA CLÍNICA)
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Anamnesis (Historia Clínica)', 3)
  drawFieldRow([
    { label: 'Inicio del problema', value: evaluacion.inicio_problema },
    { label: 'Mecanismo de lesión', value: evaluacion.mecanismo_lesion },
  ])
  if (evaluacion.escala_eva !== undefined && evaluacion.escala_eva !== null) {
    drawEVAScale(evaluacion.escala_eva)
  }
  drawField('Factores que empeoran', evaluacion.factores_empeoran)
  drawField('Factores que alivian', evaluacion.factores_alivian)
  drawField('Antecedentes médicos', evaluacion.antecedentes_medicos)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 4. OBSERVACIÓN Y ANÁLISIS POSTURAL
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Observación y Análisis Postural', 4)
  drawField('Postura estática (de pie/sentado)', evaluacion.postura_estatica)
  drawField('Alteraciones visibles', evaluacion.alteraciones_visibles)
  drawField('Análisis de la marcha', evaluacion.analisis_marcha)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 5. EVALUACIÓN DEL MOVIMIENTO
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Evaluación del Movimiento', 5)
  drawField('Rango de movimiento (activo y pasivo)', evaluacion.rango_movimiento)
  drawField('Limitaciones', evaluacion.limitaciones_movimiento)
  drawField('Dolor durante el movimiento', evaluacion.dolor_movimiento)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 6. EVALUACIÓN MUSCULAR
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Evaluación Muscular', 6)
  drawField('Fuerza muscular (escala 0–5)', evaluacion.fuerza_muscular)
  drawField('Tono muscular', evaluacion.tono_muscular)
  drawField('Desequilibrios entre lados', evaluacion.desequilibrios)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 7. PRUEBAS ESPECÍFICAS
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Pruebas Específicas', 7)
  drawField('Test ortopédicos', evaluacion.test_ortopedicos)
  drawField('Evaluación neurológica', evaluacion.evaluacion_neurologica)
  drawField('Pruebas funcionales', evaluacion.pruebas_funcionales)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 8. RESULTADOS / HALLAZGOS
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Resultados / Hallazgos', 8)
  drawField('Resumen de hallazgos', evaluacion.hallazgos)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 9. DIAGNÓSTICO FISIOTERAPÉUTICO
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Diagnóstico Fisioterapéutico', 9)
  drawField('Interpretación funcional', evaluacion.diagnostico_fisio)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 10. OBJETIVOS DEL TRATAMIENTO
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Objetivos del Tratamiento', 10)
  drawField('Corto plazo (disminuir dolor)', evaluacion.objetivos_corto_plazo)
  drawField('Mediano plazo (mejorar movilidad)', evaluacion.objetivos_mediano_plazo)
  drawField('Largo plazo (recuperar función)', evaluacion.objetivos_largo_plazo)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 11. PLAN DE TRATAMIENTO
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Plan de Tratamiento', 11)
  drawField('Tipo de intervención', evaluacion.tipo_intervencion)
  drawField('Frecuencia', evaluacion.frecuencia_tratamiento)
  drawDivider()

  // ═══════════════════════════════════════════════════════════
  // 12. RECOMENDACIONES
  // ═══════════════════════════════════════════════════════════
  drawSectionHeader('Recomendaciones', 12)
  drawField('Ejercicios en casa', evaluacion.ejercicios_casa)
  drawField('Cambios posturales', evaluacion.cambios_posturales)
  drawField('Actividades a evitar', evaluacion.actividades_evitar)

  // ═══════════════════════════════════════════════════════════
  // 13. FIRMA DEL PROFESIONAL
  // ═══════════════════════════════════════════════════════════
  checkPageBreak(40)
  y += 10
  drawSectionHeader('Firma y Datos del Profesional', 13)
  y += 5

  // Signature line
  doc.setDrawColor(...SLATE_700 as [number, number, number])
  doc.setLineWidth(0.5)
  const sigX = margin + 10
  const sigWidth = 70
  doc.line(sigX, y + 12, sigX + sigWidth, y + 12)

  doc.setFontSize(9)
  doc.setTextColor(...SLATE_700 as [number, number, number])
  doc.setFont('helvetica', 'bold')
  doc.text(profesional.nombre_completo, sigX, y + 18)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE_400 as [number, number, number])
  doc.text(profesional.especialidad, sigX, y + 23)
  if (profesional.registro_profesional) {
    doc.text(`Reg. ${profesional.registro_profesional}`, sigX, y + 28)
  }

  // Add page footers to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...SLATE_400 as [number, number, number])
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    doc.text('FisioGestión — Documento generado digitalmente', pageWidth / 2, pageHeight - 6, { align: 'center' })
  }

  // Save
  const fileName = `Evaluacion_${evaluacion.nombre.replace(/\s+/g, '_')}_${evaluacion.fecha_valoracion}.pdf`
  doc.save(fileName)
}
