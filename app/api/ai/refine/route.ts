import { NextResponse } from 'next/server'
import { CohereClientV2 } from 'cohere-ai'

// Inicializamos con tu API KEY de Cohere
const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY || ''
})

export async function POST(req: Request) {
  try {
    const { text, fieldName } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const prompt = `Contexto: Eres un asistente experto para fisioterapeutas. 
Tarea: Transforma notas coloquiales a lenguaje clínico, técnico, profesional y conciso adecuado para una historia clínica.

Sección de la evaluación: "${fieldName}"
Entrada escrita por el fisioterapeuta: "${text}"

Resultado técnico profesional (entrega ÚNICAMENTE el texto procesado):`

    // Usamos Cohere para el procesamiento de texto clínico
    const response = await cohere.chat({
      model: 'command-r-plus', // 'command-r-plus' o el solicitado 'command-a-03-2025' si está disponible
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Extraer la respuesta (Cohere V2 format) con manejo seguro de tipos
    const content = response.message?.content
    let refinedText = ''
    
    if (Array.isArray(content) && content[0] && 'text' in content[0]) {
      refinedText = (content[0] as { text: string }).text
    }

    return new Response(refinedText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    })

  } catch (error: any) {
    console.error('Error crítico en AI Refine (Cohere):', error)
    return NextResponse.json(
      { error: 'Error al generar el texto mejorado con Cohere' },
      { status: 500 }
    )
  }
}