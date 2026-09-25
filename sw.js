/* GuitarQuest service worker: cache-first so the app starts offline in under two seconds (REQ-PF-1, REQ-NF-3).
 * Bump VERSION whenever a file changes. */
const VERSION = 'gq-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/audio.js',
  'js/chords.js',
  'js/controls.js',
  'js/curriculum.js',
  'js/lesson.js',
  'js/notation.js',
  'js/render.js',
  'js/scoring.js',
  'js/songs.js',
  'js/sound.js',
  'js/store.js',
  'js/theory.js',
  'js/tuner.js',
  'js/ui-lesson.js',
  'js/ui-profiles.js',
  'js/ui-settings.js',
  'js/ui.js',
  'js/util.js',
  'js/worklet.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'phase0/app.js',
  'phase0/index.html',
  'phase0/pitch-worklet.js',
  'phase0/style.css',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
