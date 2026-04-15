import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Inicializamos con tu API KEY de Google AI Studio
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
  try {
    const { text, fieldName } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Usamos Gemini 1.5 Flash: el más rápido y preciso para tareas de texto
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.15,
        topP: 0.95,
      }
    });

    const prompt = `
Contexto: Eres un asistente experto para fisioterapeutas. 
Tarea: Transforma notas coloquiales a lenguaje clínico, técnico, profesional y conciso adecuado para una historia clínica.

Sección de la evaluación: "${fieldName}"
Entrada escrita por el fisioterapeuta: "${text}"

Resultado técnico profesional (entrega ÚNICAMENTE el texto procesado):`

    // Iniciamos el streaming nativo de Gemma 3
    const result = await model.generateContentStream(prompt);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(new TextEncoder().encode(chunkText));
            }
          }
          controller.close();
        } catch (streamError) {
          console.error('Error durante el streaming de Gemma:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error: any) {
    console.error('Error crítico en AI Refine (Gemma 3):', error)
    return NextResponse.json(
      { error: 'Error al generar el texto mejorado con Gemma' },
      { status: 500 }
    )
  }
}