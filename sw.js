/* Shotboard service worker — network-first for the app shell, so a new
   index.html on GitHub Pages is picked up automatically on the next launch.
   IndexedDB (your projects, playbook, reminders) is NEVER touched by this. */

const CACHE = 'shotboard-shell-v2';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
  // don't auto-activate; the page asks via SKIP_WAITING so the user controls the moment
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cache the PDF.js library so PDF import keeps working offline after the first use.
  if (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.includes('pdf.js')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;   // let CDN fonts etc. behave normally

  // Network-first: always try to get the newest file, fall back to cache offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});
