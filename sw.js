/* ============================================================
   HOSANNIA · service worker
   ------------------------------------------------------------
   Solo hace que la app se pueda instalar y abra rápido: guarda el
   armazón (HTML, CSS, JS, iconos) y lo sirve si la red falla.
   NUNCA guarda datos de Supabase ni archivos de partituras: esos
   son privados y van siempre a la red.
============================================================ */
const CACHE = 'hosannia-v1';
const SHELL = [
  'campus.html', 'academia.html', 'manifest.webmanifest',
  'public/css/brand.css', 'public/css/hosannia.css', 'public/css/campus.css',
  'public/js/config.js', 'public/js/app.js', 'public/js/campus/main.js',
  'public/img/hosannia-mark.png', 'public/img/hosannia-mark-white.png', 'public/img/hosannia-icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;         // nada de terceros ni escrituras
  if (url.pathname.startsWith('/api/')) return;                                      // pagos: siempre a la red
  // red primero y copia de respaldo: así un despliegue nuevo se ve enseguida
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('campus.html')))
  );
});
