const CACHE_NAME = 'fisio-gestion-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/manifest-agendar.json',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames.filter(name => name.startsWith('fisio-gestion-') && name !== CACHE_NAME).map(name => caches.delete(name))
      )
      await self.clients.claim()
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estrategia Stale-While-Revalidate para archivos estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interceptar peticiones de Next.js/Turbopack/HMR
  if (url.pathname.startsWith('/_next') || url.pathname.includes('__next') || url.pathname.includes('hot-reloader')) {
    return;
  }

  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') {
    return;
  }

  // No cachear peticiones a Supabase (se manejan con IndexedDB en el cliente alternativamente)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Evitar interceptar requests de extensiones
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Evitar error de redirecciones en navegaciones principales (Next.js server redirects)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Evitar cachear respuestas redirigidas
        if (networkResponse.redirected) {
          return networkResponse;
        }

        // Verificar que la respuesta sea válida antes de cachear
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // En caso de error de red (offline total), devolver la copia cacheada si existe
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Nueva Notificación';
      const options = {
        body: data.body || 'Tienes un nuevo mensaje.',
        icon: '/logo.png',
        badge: '/logo.png',
        data: {
          url: data.data?.url || '/'
        },
        vibrate: [100, 50, 100],
      };

      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = new URL(urlToOpen, self.location.origin).href;
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
