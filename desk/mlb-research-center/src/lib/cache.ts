const PREFIX = 'mlb-cache-'
const ACCESS_LOG_KEY = 'mlb-cache-access-log'
const MAX_ENTRIES = 100

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

function getAccessLog(): string[] {
  try {
    const raw = localStorage.getItem(ACCESS_LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function touchAccessLog(key: string): void {
  try {
    const log = getAccessLog().filter((k) => k !== key)
    log.push(key)
    if (log.length > MAX_ENTRIES * 1.5) log.splice(0, log.length - MAX_ENTRIES)
    localStorage.setItem(ACCESS_LOG_KEY, JSON.stringify(log))
  } catch { /* non-critical */ }
}

function evictOldest(count: number): void {
  try {
    const log = getAccessLog()
    const toEvict = log.slice(0, count)
    toEvict.forEach((k) => localStorage.removeItem(PREFIX + k))
    localStorage.setItem(ACCESS_LOG_KEY, JSON.stringify(log.slice(count)))
  } catch { /* non-critical */ }
}

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp > entry.ttl * 60 * 1000) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    touchAccessLog(key)
    return entry.data
  } catch {
    return null
  }
}

export function setCache<T>(key: string, data: T, ttl: number = 5): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry))
    touchAccessLog(key)
  } catch {
    // QuotaExceededError — evict 20 oldest entries and retry
    for (let i = 0; i < 3; i++) {
      evictOldest(20)
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(entry))
        touchAccessLog(key)
        return
      } catch { /* continue evicting */ }
    }
    console.warn('Cache set failed after eviction — storage full')
  }
}

export function clearCache(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem(PREFIX + key)
    } else {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
      localStorage.removeItem(ACCESS_LOG_KEY)
    }
  } catch { /* non-critical */ }
}
