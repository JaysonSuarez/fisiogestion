self.addEventListener('install', (event) => {
  console.log('SW installed');
});

self.addEventListener('fetch', (event) => {
  // basic fetch listener for PWA compliance
});
