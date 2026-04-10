import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai' // Nombre correcto del paquete

// 1. Inicializa con tu API KEY (asegúrate de tenerla en .env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { text, fieldName } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // 2. Obtén el modelo específico (Gemma 3 1B IT)
    const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

    const prompt = `
Eres un asistente experto para fisioterapeutas. Tu tarea es tomar las notas rápidas o coloquiales que el fisioterapeuta escribió durante la sesión y transformarlas en un lenguaje clínico, técnico, profesional y conciso adecuado para una historia clínica o reporte de evaluación.

El fisioterapeuta escribió esto para la sección "${fieldName}":
"${text}"

Reescribe este texto de forma profesional. Mantén un tono objetivo.
Devuelve ÚNICAMENTE el texto mejorado, sin introducciones, sin comillas, ni explicaciones adicionales.
`

    // 3. Iniciar streaming
    const result = await model.generateContentStream(prompt);

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          controller.enqueue(new TextEncoder().encode(chunkText));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });

  } catch (error: any) {
    console.error('Error in AI refine:', error)
    return NextResponse.json(
      { error: 'Error al generar el texto mejorado' },
      { status: 500 }
    )
  }
}