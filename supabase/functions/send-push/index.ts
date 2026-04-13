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

    // Obtener la suscripción del usuario
    const { data: subscription, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_data')
      .eq('user_id', target_user_id)
      .single()

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const userEmail = 'mailto:admin@fisiogestion.com' // Ajustar si es necesario

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured in Edge Function')
    }

    webpush.setVapidDetails(userEmail, vapidPublicKey, vapidPrivateKey)

    const payload = JSON.stringify({
      title: title || 'Notificación',
      body: body || 'Tienes una actualización.',
      data: { url: url || '/' }
    })

    try {
      await webpush.sendNotification(subscription.subscription_data, payload)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (pushError) {
      console.error('Push error:', pushError)
      
      // Si el token expiró o es inválido (404 o 410), eliminarlo
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', target_user_id)
          
        return new Response(JSON.stringify({ error: 'Subscription expired and removed' }), {
          status: pushError.statusCode,
          headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      throw pushError
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
