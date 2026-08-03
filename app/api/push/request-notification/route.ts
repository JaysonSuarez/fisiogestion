import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { nombre, num_sesiones } = await req.json()

    // 1. Obtener la URL del proyecto y el Service Role Key (Server-side only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Las solicitudes de cita las gestiona la dueña. `target_fisio` resuelve su
    // usuario por correo dentro de la Edge Function y notifica a TODOS sus
    // dispositivos en una sola llamada (antes se iteraba con su UUID a mano).
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        target_fisio: 'Liliana',
        title: '¡Nueva Solicitud de Cita! 🔔',
        body: `${nombre} quiere agendar ${num_sesiones} sesiones. Toca para ver.`,
        url: '/', // Lleva al dashboard para ver el widget de solicitudes
      }),
    })

    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}))
      console.warn('No se pudo notificar la nueva solicitud:', detalle)
      return NextResponse.json({ success: true, message: 'No devices to notify' })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error enviando notificación de solicitud:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
