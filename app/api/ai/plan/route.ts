import { NextResponse } from 'next/server'
import { CohereClientV2 } from 'cohere-ai'

const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY || ''
})

export async function POST(req: Request) {
  try {
    const { motivo_consulta, diagnostico_fisio, hallazgos, escala_eva } = await req.json()

    const prompt = `Contexto: Eres un asistente clínico experto en fisioterapia y rehabilitación.
Tarea: Basándote en la evaluación inicial de un paciente, genera una propuesta estructurada de objetivos y plan de tratamiento.

Datos de la evaluación del paciente:
- Motivo de consulta: "${motivo_consulta || 'No especificado'}"
- Hallazgos clínicos clave: "${hallazgos || 'No especificado'}"
- Diagnóstico fisioterapéutico: "${diagnostico_fisio || 'No especificado'}"
- Escala de dolor EVA: ${escala_eva || 'No especificada'}/10

Debes responder ÚNICAMENTE con un objeto JSON válido (sin código markdown de bloque, solo el JSON plano) con la siguiente estructura exacta de campos. Los textos deben ser formales, en lenguaje clínico técnico y orientados a resultados en salud:

{
  "objetivos_corto_plazo": "Texto del objetivo a corto plazo enfocado en el control de dolor y sintomatología",
  "objetivos_mediano_plazo": "Texto del objetivo a mediano plazo enfocado en ganar movilidad, flexibilidad y fuerza inicial",
  "objetivos_largo_plazo": "Texto del objetivo a largo plazo enfocado en la reincorporación funcional, prevención de recaídas y fuerza avanzada",
  "tipo_intervencion": "Detalles del plan terapéutico (ej. terapia manual, agentes físicos, dosificación de ejercicio terapéutico específico)",
  "frecuencia_tratamiento": "Ej: 2 a 3 veces por semana durante 4 semanas",
  "ejercicios_casa": "Listado numerado de 3 ejercicios básicos sugeridos para el hogar con sus repeticiones y cuidados"
}`

    const response = await cohere.chat({
      model: 'command-a-03-2025',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const content = response.message?.content
    let responseText = ''
    
    if (Array.isArray(content) && content[0] && 'text' in content[0]) {
      responseText = (content[0] as { text: string }).text
    }

    // Limpiar posibles bloques de código markdown que Cohere pueda retornar
    let cleanJson = responseText.trim()
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7)
    }
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3)
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3)
    }
    cleanJson = cleanJson.trim()

    // Intentar validar si es JSON válido
    const parsed = JSON.parse(cleanJson)

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('Error en AI Plan Generator (Cohere):', error)
    return NextResponse.json(
      { error: 'Error al generar el plan de cuidado con Cohere' },
      { status: 500 }
    )
  }
}
