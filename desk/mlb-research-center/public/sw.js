const CACHE_VERSION = 'mlb-rc-v3'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const ASSET_CACHE = `${CACHE_VERSION}-assets`
const API_CACHE = `${CACHE_VERSION}-api`
const IMAGE_CACHE = `${CACHE_VERSION}-images`
const NAV_CACHE = `${CACHE_VERSION}-nav`
const STATIC_URLS = ['/', '/offline', '/manifest.json']

const API_PATTERN = /^https:\/\/statsapi\.mlb\.com\//
const IMAGE_PATTERN = /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/
const STATIC_ASSET_PATTERN = /\/_next\/static\//
const PROXY_PATTERN = /^\/api\/proxy\//

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k.startsWith('mlb-rc-') && k !== STATIC_CACHE && !k.startsWith(`${CACHE_VERSION}-`))
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (IMAGE_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
    return
  }

  if (STATIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  if (API_PATTERN.test(url.origin)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE))
    return
  }

  if (PROXY_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidateNav(request))
    return
  }

  event.respondWith(networkFirstWithCache(request))
})

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const copy = response.clone()
    caches.open(cacheName).then((cache) => cache.put(request, copy))
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      caches.open(cacheName).then((cache) => cache.put(request, copy))
    }
    return response
  }).catch(() => cached)
  return cached || fetchPromise
}

async function staleWhileRevalidateNav(request) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      caches.open(NAV_CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  }).catch(() => cached || caches.match('/offline'))
  return cached || fetchPromise
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || caches.match('/offline')
  }
}

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  } catch {
    return caches.match(request)
  }
}
