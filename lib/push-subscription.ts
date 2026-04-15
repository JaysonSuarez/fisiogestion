import { supabase } from '@/lib/supabase';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUser(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      'BID8H2P1XFQ6zAOoSu8AzDHix2wyjct7RoLvCfmOVFuUJAtteowZPd64c69UsFboyfDrqYmM2jjebG1EdaF5-A0';
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    const subscriptionJSON = subscription.toJSON();
    const endpoint = subscriptionJSON.endpoint;

    // Obtener usuario real
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No hay usuario autenticado para suscribir');
      return false;
    }

    // 1. Limpiar registros viejos del mismo endpoint para este usuario para evitar duplicidad de dispositivo
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('subscription_data->>endpoint', endpoint);

    // 2. Insertar nuevo registro con user_id real
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        subscription_data: subscriptionJSON,
      });

    if (error) {
      console.error('Error saving subscription:', error);
      return false;
    }

    console.log('✅ Suscripción exitosa para:', user.email);
    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}
