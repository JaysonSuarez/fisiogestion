import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPushToSubscription } from '@/lib/server/push'

export async function POST(req: Request) {
  const user = await getApiUser(req)

  if (!user) {
    return NextResponse.json({ error: 'La sesión expiró. Inicia sesión y vuelve a intentarlo.' }, { status: 401 })
  }

  // El navegador manda el endpoint de SU suscripción. Sin él no hay forma de saber
  // desde qué dispositivo se pidió la prueba: antes se cogía una fila cualquiera
  // del usuario (`.limit(1)`), así que con dos dispositivos la notificación podía
  // llegarle al otro.
  const { endpoint } = await req.json().catch(() => ({ endpoint: null }))
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'No se encontró la suscripción de este dispositivo.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: subscription, error } = await admin
    .from('push_subscriptions')
    .select('subscription_data')
    .eq('user_id', user.id)
    .eq('subscription_data->>endpoint', endpoint)
    .maybeSingle()

  if (error) {
    console.error('No se pudo consultar la suscripción push:', error)
    return NextResponse.json({ error: 'No se pudo verificar este dispositivo.' }, { status: 500 })
  }
  if (!subscription) {
    return NextResponse.json(
      { error: 'Este dispositivo no está registrado. Vuelve a activar las notificaciones.' },
      { status: 404 }
    )
  }

  const result = await sendPushToSubscription(
    subscription.subscription_data,
    'Prueba de FisioGestión 💖',
    '¡Listo! Las notificaciones funcionan en este dispositivo.',
    '/agenda',
  )
  return NextResponse.json(result, { status: result.delivered ? 200 : 502 })
}
