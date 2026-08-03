import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const _corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: _corsHeaders })
  }

  try {
    const payloadIn = await req.json()
    const {
      // Destinos, del más específico al más amplio
      subscription,      // una suscripción concreta (objeto web-push)
      endpoint,          // el dispositivo exacto que hace la petición
      target_user_id,
      target_fisio,      // nombre de la fisioterapeuta: se resuelve por correo
      target_role,
      // Contenido: se acepta plano o anidado en `notification`
      title, body, url,
      notification,
    } = payloadIn

    const titulo = notification?.title ?? title ?? 'Notificación'
    const cuerpo = notification?.body ?? body ?? 'Tienes una actualización.'
    const destino = notification?.data?.url ?? url ?? '/'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let subscriptions: { subscription_data: any }[] = []

    if (subscription?.endpoint) {
      // Caso más específico: nos dan la suscripción entera (prueba de un dispositivo).
      subscriptions = [{ subscription_data: subscription }]
    } else if (endpoint) {
      // El dispositivo que pidió la notificación, identificado por su endpoint.
      const { data } = await supabase
        .from('push_subscriptions')
        .select('subscription_data')
        .eq('subscription_data->>endpoint', endpoint)
      subscriptions = data ?? []
    } else {
      let query = supabase.from('push_subscriptions').select('subscription_data')

      if (target_user_id) {
        query = query.eq('user_id', target_user_id)
      } else if (target_fisio) {
        // La fisioterapeuta se identifica por su correo (nombre@fisio.com), igual
        // que en la app. Sin esto un recordatorio iría a todo el mundo.
        const { data: usuarios } = await supabase.auth.admin.listUsers()
        const usuario = usuarios?.users?.find(u =>
          (u.email ?? '').toLowerCase().includes(String(target_fisio).toLowerCase()))
        if (!usuario) return json({ error: `Sin usuario para ${target_fisio}` }, 404)
        query = query.eq('user_id', usuario.id)
      } else if (target_role) {
        query = query.eq('role', target_role)
      } else {
        // Antes, sin destino la consulta salía sin filtro y la notificación llegaba
        // a TODOS los dispositivos de todos los usuarios (pacientes incluidos).
        // Un envío sin destinatario es siempre un error de quien llama.
        return json({ error: 'Falta el destinatario: subscription, endpoint, target_user_id, target_fisio o target_role' }, 400)
      }

      const { data, error: subError } = await query
      if (subError) return json({ error: subError.message }, 500)
      subscriptions = data ?? []
    }

    if (subscriptions.length === 0) {
      return json({ error: 'No subscriptions found' }, 404)
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured in Edge Function')
    }

    webpush.setVapidDetails('mailto:admin@fisiogestion.com', vapidPublicKey, vapidPrivateKey)

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      data: { url: destino },
    })

    const results = []

    for (const sub of subscriptions) {
      if (!sub.subscription_data?.endpoint) continue

      try {
        await webpush.sendNotification(sub.subscription_data, payload)
        results.push({ success: true, endpoint: sub.subscription_data.endpoint })
      } catch (pushError: any) {
        console.error('Push error:', pushError?.statusCode, pushError?.message)
        // 404/410 = suscripción muerta (app desinstalada, permiso revocado).
        // 403 = firmada con otras claves VAPID; tampoco se podrá usar nunca más.
        const code = pushError?.statusCode
        if (code === 404 || code === 410 || code === 403) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription_data->>endpoint', sub.subscription_data.endpoint)
        }
        results.push({ error: pushError.message, statusCode: code, endpoint: sub.subscription_data.endpoint })
      }
    }

    const enviados = results.filter(r => (r as any).success).length
    return json({ success: enviados > 0, enviados, total: results.length, results })

  } catch (error) {
    return json({ error: error.message }, 500)
  }
})
