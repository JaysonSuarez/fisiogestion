import { NextResponse } from 'next/server'
import { sendPushToFisio } from '@/lib/server/push'

export async function POST(req: Request) {
  try {
    const { nombre, num_sesiones } = await req.json()

    const result = await sendPushToFisio(
      'Liliana',
      '¡Nueva solicitud de cita! 🔔',
      `${nombre} quiere agendar ${num_sesiones} sesiones. Toca para ver.`,
      '/',
    )
    return NextResponse.json({ success: result.delivered }, { status: result.delivered ? 200 : 502 })
  } catch (error: any) {
    console.error('Error enviando notificación de solicitud:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
