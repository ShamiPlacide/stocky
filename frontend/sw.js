const CACHE_NAME = "stocky-v4";
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const STATIC_ASSETS = [
  "/index.html",
  "/dashboard.html",
  "/css/styles.css",
  "/js/config.js",
  "/js/auth.js",
  "/js/inventory.js",
  "/js/modals.js",
  "/js/offline.js",
  "/js/report.js",
  "/js/staff.js",
  "/js/sales.js",
  "/manifest.json",
  JSPDF_URL,
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET API requests — let the page JS handle queuing
  if (url.pathname.startsWith("/api/") && request.method !== "GET") {
    return;
  }

  // Network-first for GET API calls
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  // Cache-first for all static assets
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
