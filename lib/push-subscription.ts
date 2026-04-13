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

export async function subscribeUser() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return false;
  }

  try {
    // Paso 7: Activación por clic (esto ya se llama desde el botón)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return false;
    }

    // Paso 8: Esperar a que el SW esté activo
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) {
      console.warn('Service worker not active yet');
      return false;
    }

    // Usar la llave pública (VITE_ o NEXT_PUBLIC_)
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
                          process.env.VITE_VAPID_PUBLIC_KEY || 
                          'BID8H2P1XFQ6zAOoSu8AzDHix2wyjct7RoLvCfmOVFuUJAtteowZPd64c69UsFboyfDrqYmM2jjebG1EdaF5-A0';
    
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    const { data: { user } } = await supabase.auth.getUser();

    // Sincronización: Usar toJSON() para asegurar compatibilidad con todos los navegadores
    const subscriptionJSON = subscription.toJSON();

    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: user?.id || null,
        subscription_data: subscriptionJSON,
      });

    if (error) {
      if (error.code === '23505') return true;
      console.error('Error syncing with Supabase:', error);
      return false;
    }

    console.log('Push subscription successful');
    return true;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}
