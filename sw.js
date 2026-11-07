// sw.js — Service Worker pour DAFTAR
// Permet à l'application de fonctionner hors-ligne.

const CACHE_NAME = 'daftar-v1';

// Fichiers à mettre en cache (pour le hors-ligne)
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/styles.css',
  './src/main.js',
  './src/core/format.js',
  './src/core/dates.js',
  './src/core/dom.js',
  './src/core/state.js',
  './src/core/excel.js',
  './src/features/classes.js',
  './src/features/attendance.js',
  './src/features/monthly.js',
  './src/features/grades.js',
  './src/features/dashboard.js',
  './src/features/discipline.js',
  './src/features/agenda.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Installation : on met en cache les fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activation : on supprime les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch : on sert depuis le cache, sinon depuis internet
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas cacher les requêtes Firebase ou XLSX (toujours en ligne)
  if (url.hostname.includes('gstatic') || url.hostname.includes('firebase') || url.hostname.includes('sheetjs')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((netResponse) => {
        // Mettre en cache les nouvelles ressources
        if (netResponse && netResponse.status === 200) {
          const cloned = netResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return netResponse;
      }).catch(() => {
        // Si tout échoue (hors-ligne), on sert index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});