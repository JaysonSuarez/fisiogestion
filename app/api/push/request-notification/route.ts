import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { nombre, num_sesiones } = await req.json()

    // 1. Obtener la URL del proyecto y el Service Role Key (Server-side only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // ID del usuario de Liliana (obtenido previamente) 
    // lo ideal sería buscarlo dinámicamente pero por ahora usaremos el de la cuenta principal
    const LILIANA_USER_ID = 'ab7298a2-f9b3-4415-a907-376627886e74'

    // 2. Buscar todas las suscripciones de Liliana
    // Usamos fetch directo a Supabase con Service Role para saltar RLS
    const subsResponse = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${LILIANA_USER_ID}`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    })
    
    const subscriptions = await subsResponse.json()

    if (!subscriptions || subscriptions.length === 0) {
      console.warn('No se encontraron suscripciones para Liliana para notificar la nueva solicitud');
      return NextResponse.json({ success: true, message: 'No devices to notify' })
    }

    // 3. Enviar la notificación a cada dispositivo registrado
    const notificationPromises = subscriptions.map(async (sub: any) => {
      return fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          subscription: sub.subscription_data,
          notification: {
            title: '¡Nueva Solicitud de Cita! 🔔',
            body: `${nombre} quiere agendar ${num_sesiones} sesiones. Toca para ver.`,
            data: { 
              url: '/', // Lleva al dashboard para ver el widget de solicitudes
              trigger_widget: 'true' 
            }
          }
        }),
      })
    })

    await Promise.all(notificationPromises)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error enviando notificación de solicitud:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
