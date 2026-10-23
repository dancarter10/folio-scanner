/* Folio service worker: works offline, caches the text reader on first use, receives shared photos. */
const VERSION = '1.0.1-20261023';
const SHELL = 'folio-shell-' + VERSION;
const OCR = 'folio-ocr-1';
const FONTS = 'folio-fonts-1';
const FILES = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./maskable-512.png","./apple-touch-icon.png","./ocr-worker.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('folio-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(cacheName, req) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // photos shared into the app
  if (req.method === 'POST' && url.searchParams.has('share-target')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const files = form.getAll('photos').filter((f) => f && typeof f === 'object');
        const cache = await caches.open('folio-share');
        for (const k of await cache.keys()) await cache.delete(k);
        let i = 0;
        for (const f of files) {
          await cache.put(new Request(`./__shared/${Date.now()}-${i++}`), new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg', 'X-Name': encodeURIComponent(f.name || 'photo.jpg') } }));
        }
        return Response.redirect('./?shared=' + files.length, 303);
      } catch (err) {
        return Response.redirect('./', 303);
      }
    })());
    return;
  }
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith((async () => {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) || fetch(req);
      })());
      return;
    }
    if (url.pathname.includes('/ocr/')) { e.respondWith(cacheFirst(OCR, req)); return; }
    e.respondWith(caches.open(SHELL).then((c) => c.match(req)).then((hit) => hit || fetch(req)));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' && /tesseract/.test(url.pathname)) {
    e.respondWith(cacheFirst(OCR, req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(FONTS, req));
  }
});
