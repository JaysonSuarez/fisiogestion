import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // El navegador manda el endpoint de SU suscripción. Sin él no hay forma de saber
  // desde qué dispositivo se pidió la prueba: antes se cogía una fila cualquiera
  // del usuario (`.limit(1)`), así que con dos dispositivos la notificación podía
  // llegarle al otro.
  const { endpoint } = await req.json().catch(() => ({ endpoint: null }))

  let query = supabase
    .from('push_subscriptions')
    .select('subscription_data')
    .eq('user_id', user.id)

  if (endpoint) query = query.eq('subscription_data->>endpoint', endpoint)

  const { data: subscriptions } = await query

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json(
      { error: endpoint
          ? 'Este dispositivo no está registrado. Vuelve a activar las notificaciones.'
          : 'No se encontró ninguna suscripción para tu usuario.' },
      { status: 404 }
    )
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        // Suscripción concreta: la notificación va solo a este dispositivo.
        subscription: subscriptions[0].subscription_data,
        notification: {
          title: 'Prueba de FisioGestión 💖',
          body: '¡Listo! Las notificaciones funcionan en este dispositivo.',
          data: { url: '/agenda' },
        },
      }),
    })

    const result = await response.json()
    return NextResponse.json(result, { status: response.ok ? 200 : response.status })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
