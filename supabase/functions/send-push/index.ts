import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const _corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: _corsHeaders })
  }

  try {
    const { target_user_id, title, body, url } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Dado que no hay auth estricto, obremos enviando a todas las suscripciones o a las válidas
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_data, user_id')

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ error: 'No subscriptions found' }), {
        status: 404,
        headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const userEmail = 'mailto:admin@fisiogestion.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured in Edge Function')
    }

    webpush.setVapidDetails(userEmail, vapidPublicKey, vapidPrivateKey)

    const payload = JSON.stringify({
      title: title || 'Notificación',
      body: body || 'Tienes una actualización.',
      data: { url: url || '/' }
    })

    const results = []

    for (const sub of subscriptions) {
      if (!sub.subscription_data || !sub.subscription_data.endpoint) continue;

      try {
        await webpush.sendNotification(sub.subscription_data, payload)
        results.push({ success: true, endpoint: sub.subscription_data.endpoint })
      } catch (pushError: any) {
        console.error('Push error:', pushError)
        // Limpiamos los expirados
        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription_data->>endpoint', sub.subscription_data.endpoint)
        }
        results.push({ error: pushError.message, endpoint: sub.subscription_data.endpoint })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
