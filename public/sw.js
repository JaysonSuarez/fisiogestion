self.addEventListener('install', (event) => {
  console.log('SW installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // basic fetch listener for PWA compliance
});

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        tag: data.tag || 'fisio-noti',
        requireInteraction: true,
        data: data.data || {}
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (e) {
      console.error('Error parsing push data', e);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL('/', self.location.origin).href;
  
  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url.includes(self.location.origin)) {
            matchingClient = windowClient;
            break;
        }
    }

    if (matchingClient) {
      // Send a message to the open window to trigger WA or modal
      matchingClient.postMessage({ 
        type: 'OPEN_WHATSAPP', 
        data: event.notification.data 
      });
      return matchingClient.focus();
    } else {
      // App is closed. We must open the app with query params
      let openUrl = urlToOpen;
      if (event.notification.data && event.notification.data.citaId) {
        openUrl = `${openUrl}?trigger_wa=true&cita_id=${event.notification.data.citaId}&phase=${event.notification.data.phase || '1h'}`;
      }
      return self.clients.openWindow(openUrl);
    }
  });

  event.waitUntil(promiseChain);
});
