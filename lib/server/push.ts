import 'server-only'
import webpush from 'web-push'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { Fisioterapeuta } from '@/types'

type PushResult = { delivered: boolean; status?: number; error?: string }

type PushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

function getVapidDetails() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { subject: 'mailto:admin@fisiogestion.com', publicKey, privateKey }
}

/** Envía un push desde el servidor de Next, sin depender de la autorización de la Edge Function. */
export async function sendPushToSubscription(
  subscription: PushSubscription,
  title: string,
  body: string,
  url: string,
): Promise<PushResult> {
  const vapidDetails = getVapidDetails()
  if (!vapidDetails) return { delivered: false, error: 'Falta configurar las claves VAPID del servidor.' }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { delivered: false, error: 'La suscripción de este dispositivo está incompleta.' }
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, data: { url } }),
      { vapidDetails, TTL: 60 * 60 },
    )
    return { delivered: true }
  } catch (error: any) {
    const status = Number(error?.statusCode) || undefined
    if (status === 404 || status === 410 || status === 403) {
      // Suscripciones vencidas o firmadas con otras claves no volverán a funcionar.
      try {
        await getSupabaseAdmin().from('push_subscriptions').delete()
          .eq('subscription_data->>endpoint', subscription.endpoint)
      } catch (cleanupError) {
        console.warn('No se pudo limpiar la suscripción push vencida:', cleanupError)
      }
    }
    const message = error?.message || 'No se pudo entregar la notificación push.'
    console.warn('Error enviando notificación push:', status, message)
    return { delivered: false, status, error: message }
  }
}

export async function sendPushToFisio(
  targetFisio: Fisioterapeuta,
  title: string,
  body: string,
  url: string,
): Promise<PushResult> {
  try {
    const admin = getSupabaseAdmin()
    let usuario
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (error) {
        console.warn(`No se pudo buscar la cuenta de ${targetFisio}:`, error.message)
        return { delivered: false, error: error.message }
      }
      usuario = data.users.find(user => (user.email || '').toLowerCase().includes(targetFisio.toLowerCase()))
      if (usuario || data.users.length < 100) break
    }
    if (!usuario) {
      const error = `No se encontró la cuenta de ${targetFisio}.`
      console.warn(error)
      return { delivered: false, error }
    }

    const { data: subscriptions, error } = await admin.from('push_subscriptions')
      .select('subscription_data').eq('user_id', usuario.id)
    if (error) {
      console.warn(`No se pudieron consultar los dispositivos de ${targetFisio}:`, error.message)
      return { delivered: false, error: error.message }
    }
    if (!subscriptions?.length) {
      const message = `${targetFisio} no tiene notificaciones activadas en ningún dispositivo.`
      console.warn(message)
      return { delivered: false, error: message }
    }

    const results = await Promise.all(subscriptions.map(({ subscription_data }) =>
      sendPushToSubscription(subscription_data, title, body, url)))
    const delivered = results.some(result => result.delivered)
    return delivered
      ? { delivered: true }
      : { delivered: false, status: results.find(result => result.status)?.status, error: results.find(result => result.error)?.error }
  } catch (error: any) {
    console.error(`Error preparando push para ${targetFisio}:`, error?.message || error)
    return { delivered: false, error: error?.message || 'Error de conexión.' }
  }
}
