import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
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

  // Buscar la suscripción del usuario
  const { data: subscription } = await supabase
    .from('push_subscriptions')
    .select('subscription_data')
    .eq('user_id', user.id)
    .single()

  if (!subscription) {
    return NextResponse.json({ error: 'No se encontró suscripción para este dispositivo' }, { status: 404 })
  }

  // Llamar a la Edge Function de Supabase para enviar el push
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        subscription: subscription.subscription_data,
        notification: {
          title: 'Prueba de FisioGestión 💖',
          body: 'hola mi amor <3',
          data: { url: '/agenda' }
        }
      }),
    })

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
