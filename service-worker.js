// First Steps service worker
// 1) Stale-while-revalidate for the app shell (works offline, refreshes quietly).
// 2) Web Share Target: receives a file shared to the installed app via POST,
//    parks it in a small cache and redirects into the app, which then asks
//    "open with which tool?". Bump CACHE_NAME when the precache list changes.
const CACHE_NAME = 'first-steps-cache-v1';
const SHARE_CACHE = 'first-steps-share';
const SHARE_KEY = '/shared-file';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/favicon.ico',
  '/logo.png',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== SHARE_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

async function handleShare(request) {
  const home = new URL('/', self.location.origin).href;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (file && typeof file === 'object' && 'size' in file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_KEY, new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'shared-image')
        }
      }));
      return Response.redirect(new URL('/?shared=1', self.location.origin).href, 303);
    }
  } catch (err) {
    // fall through to a plain redirect home
  }
  return Response.redirect(home, 303);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/share-target/') {
    event.respondWith(handleShare(event.request));
    return;
  }

  // Only simple same-origin GETs are cached; everything else goes to the network.
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request, { ignoreSearch: true }).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            // Don't store URLs with a query string (e.g. /?shared=1)
            if (response && response.ok && !url.search) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
