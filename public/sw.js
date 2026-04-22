// ORVANN POS — Service Worker (Fase 1: cache básico del shell)
//
// Cachea assets estáticos (JS/CSS/fonts/iconos) para que el POS cargue
// sin red. Las queries a Supabase NO se cachean — si no hay red, la app
// muestra banner y bloquea la venta.
//
// F1.5 extiende este SW para:
//   - Cachear respuestas de GET a /variantes/productos/disenos en IDB.
//   - Queue de ventas offline con background sync.

const CACHE = 'orvann-pos-v1'

const PRECACHE = [
  '/',
  '/pos',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Solo GET
  if (req.method !== 'GET') return

  // No interceptamos requests a Supabase / Google Fonts CDN (stale-while-revalidate no nos conviene aquí)
  if (url.hostname.endsWith('supabase.co')) return
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    // Cache-first para fuentes
    event.respondWith(
      caches.match(req).then(cached => cached ?? fetch(req).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(req, clone))
        return res
      })),
    )
    return
  }

  // Para navegación HTML: network-first con fallback a cache (shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(req, clone))
        return res
      }).catch(() => caches.match(req).then(c => c ?? caches.match('/pos'))),
    )
    return
  }

  // Para assets (JS/CSS/images): cache-first con update en background
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(req, clone))
        }
        return res
      }).catch(() => cached)
      return cached ?? fetchPromise
    }),
  )
})
