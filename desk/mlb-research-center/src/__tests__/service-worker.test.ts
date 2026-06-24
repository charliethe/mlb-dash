import { describe, it, expect, beforeEach, vi } from 'vitest'

const CACHE_VERSION = 'mlb-rc-v3'
const IMAGE_PATTERN = /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/
const STATIC_ASSET_PATTERN = /\/_next\/static\//
const API_PATTERN = /^https:\/\/statsapi\.mlb\.com\//
const PROXY_PATTERN = /^\/api\/proxy\//

describe('Service Worker — URL patterns', () => {
  it('matches image URLs', () => {
    expect(IMAGE_PATTERN.test('/icons/icon-192.svg')).toBe(true)
    expect(IMAGE_PATTERN.test('/logo.png')).toBe(true)
    expect(IMAGE_PATTERN.test('/photo.jpg?w=200')).toBe(true)
    expect(IMAGE_PATTERN.test('/page.html')).toBe(false)
    expect(IMAGE_PATTERN.test('/api/news')).toBe(false)
  })

  it('matches Next.js static assets', () => {
    expect(STATIC_ASSET_PATTERN.test('/_next/static/chunks/app/layout.js')).toBe(true)
    expect(STATIC_ASSET_PATTERN.test('/_next/static/css/app.css')).toBe(true)
    expect(STATIC_ASSET_PATTERN.test('/api/news')).toBe(false)
    expect(STATIC_ASSET_PATTERN.test('/favicon.ico')).toBe(false)
  })

  it('matches MLB Stats API URLs', () => {
    expect(API_PATTERN.test('https://statsapi.mlb.com/api/v1/standings')).toBe(true)
    expect(API_PATTERN.test('https://statsapi.mlb.com/api/v1/people/123')).toBe(true)
    expect(API_PATTERN.test('https://other-api.com/data')).toBe(false)
    expect(API_PATTERN.test('/api/news')).toBe(false)
  })

  it('matches proxy API URLs', () => {
    expect(PROXY_PATTERN.test('/api/proxy/standings')).toBe(true)
    expect(PROXY_PATTERN.test('/api/proxy/schedule?date=2026-06-24')).toBe(true)
    expect(PROXY_PATTERN.test('/api/news')).toBe(false)
    expect(PROXY_PATTERN.test('https://statsapi.mlb.com/')).toBe(false)
  })

  it('generates correct cache name prefix', () => {
    expect(CACHE_VERSION).toBe('mlb-rc-v3')
    expect(`${CACHE_VERSION}-static`).toBe('mlb-rc-v3-static')
    expect(`${CACHE_VERSION}-api`).toBe('mlb-rc-v3-api')
    expect(`${CACHE_VERSION}-images`).toBe('mlb-rc-v3-images')
    expect(`${CACHE_VERSION}-assets`).toBe('mlb-rc-v3-assets')
    expect(`${CACHE_VERSION}-nav`).toBe('mlb-rc-v3-nav')
  })
})

describe('Service Worker — caching logic', () => {
  let cacheStorage: Map<string, Response>
  let mockCaches: Partial<CacheStorage>

  beforeEach(() => {
    cacheStorage = new Map()
    mockCaches = {
      open: vi.fn().mockResolvedValue({
        put: vi.fn().mockImplementation((req: Request, res: Response) => {
          cacheStorage.set(req.url, res)
        }),
        match: vi.fn().mockImplementation(async (req: Request) => {
          return cacheStorage.get(req.url) || undefined
        }),
        addAll: vi.fn().mockResolvedValue(undefined),
      }),
      match: vi.fn().mockImplementation(async (req: Request) => {
        return cacheStorage.get(req.url) || undefined
      }),
    }
    globalThis.caches = mockCaches as unknown as CacheStorage
    globalThis.fetch = vi.fn()
  })

  async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request.clone())
    if (response.ok) {
      const copy = response.clone()
      cache.put(request, copy)
    }
    return response
  }

  async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    const fetchPromise = fetch(request.clone()).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(cacheName).then((c) => c.put(request, copy))
      }
      return response
    }).catch(() => cached as Response)
    return cached || fetchPromise
  }

  async function networkFirstWithFallback(request: Request): Promise<Response> {
    try {
      const response = await fetch(request.clone())
      if (response.ok) {
        const copy = response.clone()
        const cache = await caches.open(`${CACHE_VERSION}-static`)
        cache.put(request, copy)
      }
      return response
    } catch {
      const cached = await caches.match(request)
      return cached || new Response('Offline', { status: 200 })
    }
  }

  it('cacheFirst returns cached response when available', async () => {
    const url = 'https://example.com/_next/static/chunk.js'
    const cachedResponse = new Response('cached', { status: 200 })
    cacheStorage.set(url, cachedResponse)
    const result = await cacheFirst(new Request(url), `${CACHE_VERSION}-assets`)
    expect(await result.text()).toBe('cached')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cacheFirst fetches and caches when not cached', async () => {
    const url = 'https://example.com/_next/static/chunk.js'
    const networkResponse = new Response('network', { status: 200 })
    vi.mocked(fetch).mockResolvedValue(networkResponse)
    const result = await cacheFirst(new Request(url), `${CACHE_VERSION}-assets`)
    expect(await result.text()).toBe('network')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('staleWhileRevalidate returns cached immediately', async () => {
    const url = 'https://statsapi.mlb.com/api/v1/standings'
    const cachedResponse = new Response('cached-data', { status: 200 })
    cacheStorage.set(url, cachedResponse)
    const networkResponse = new Response('new-data', { status: 200 })
    vi.mocked(fetch).mockResolvedValue(networkResponse)
    const result = await staleWhileRevalidate(new Request(url), `${CACHE_VERSION}-api`)
    expect(await result.text()).toBe('cached-data')
  })

  it('staleWhileRevalidate fetches when nothing cached', async () => {
    const url = 'https://statsapi.mlb.com/api/v1/standings'
    const networkResponse = new Response('new-data', { status: 200 })
    vi.mocked(fetch).mockResolvedValue(networkResponse)
    const result = await staleWhileRevalidate(new Request(url), `${CACHE_VERSION}-api`)
    expect(await result.text()).toBe('new-data')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('networkFirstWithFallback returns network response on success', async () => {
    const url = 'https://example.com/'
    const networkResponse = new Response('page-content', { status: 200 })
    vi.mocked(fetch).mockResolvedValue(networkResponse)
    const result = await networkFirstWithFallback(new Request(url))
    expect(await result.text()).toBe('page-content')
  })

  it('networkFirstWithFallback returns cached offline page on failure', async () => {
    const url = 'https://example.com/some-page'
    const offlineResponse = new Response('Offline', { status: 200 })
    cacheStorage.set(url, offlineResponse)
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const result = await networkFirstWithFallback(new Request(url))
    expect(await result.text()).toBe('Offline')
  })

  it('networkFirstWithFallback returns generic offline page when nothing cached', async () => {
    const url = 'https://example.com/never-cached'
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const result = await networkFirstWithFallback(new Request(url))
    expect(await result.text()).toBe('Offline')
  })
})
