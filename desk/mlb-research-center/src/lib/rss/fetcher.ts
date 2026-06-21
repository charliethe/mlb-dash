import type { NewsItem, NewsCategory, AlertImportance } from '@/types'

export async function fetchMLBNews(): Promise<NewsItem[]> {
  const isServer = typeof window === 'undefined'
  const base = isServer
    ? process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`
    : ''

  try {
    const res = await fetch(`${base}/api/news?source=all`, {
      ...(isServer ? { next: { revalidate: 300 } } : { cache: 'no-store' }),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!data.success) return []
    return (data.news || []).map((n: Record<string, unknown>) => ({
      id: ((n as Record<string, unknown>).duplicateKey as string)?.slice(0, 12) || randomId(),
      source: n.source as string,
      title: n.title as string,
      url: n.url as string,
      category: n.category as NewsCategory || 'general',
      importance: n.importance as AlertImportance || 'low',
      publishedAt: n.publishedAt as string || new Date().toISOString(),
      summary: n.summary as string || '',
      duplicateKey: n.duplicateKey as string,
    }))
  } catch {
    console.warn('RSS fetch failed, returning empty')
    return []
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10)
}
