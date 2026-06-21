import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import crypto from 'crypto'

const parser = new Parser({
  customFields: { item: ['description', 'pubDate'] },
})

type AlertImportance = 'high' | 'medium' | 'low'
type NewsCategory = 'injury' | 'trade' | 'lineup' | 'roster' | 'game' | 'general'

function categorizeNews(title: string): NewsCategory {
  const lower = title.toLowerCase()
  if (lower.includes('injur') || lower.includes('il') || lower.includes('disabled list')) return 'injury'
  if (lower.includes('trade') || lower.includes('acquired') || lower.includes('waiver')) return 'trade'
  if (lower.includes('lineup') || lower.includes('batting')) return 'lineup'
  if (lower.includes('call') || lower.includes('option') || lower.includes('designated')) return 'roster'
  if (lower.includes('win') || lower.includes('loss') || lower.includes('score') || lower.includes('highlight')) return 'game'
  return 'general'
}

function classifyImportance(title: string): AlertImportance {
  const lower = title.toLowerCase()
  if (lower.includes('injur') || lower.includes('il') || lower.includes('trade') ||
      lower.includes('scratched') || lower.includes('postpon') || lower.includes('called up')) return 'high'
  if (lower.includes('lineup') || lower.includes('option') || lower.includes('activate') ||
      lower.includes('sign') || lower.includes('designated')) return 'medium'
  return 'low'
}

function createDuplicateKey(source: string, title: string, url: string): string {
  const raw = `${source}:${title}:${url}`
  return crypto.createHash('md5').update(raw).digest('hex')
}

async function fetchMLBCom(): Promise<unknown[]> {
  const res = await fetch('https://www.mlb.com/feeds/news/rss.xml', {
    headers: { 'User-Agent': 'MLB-Research-Center/1.0' },
  })
  if (!res.ok) return []
  const xml = await res.text()
  const feed = await parser.parseString(xml)
  return (feed.items || []).slice(0, 50).map((item) => ({
    source: 'mlb.com',
    title: item.title?.trim() || '',
    url: item.link?.trim() || '',
    summary: item.contentSnippet?.slice(0, 300) || item.description?.slice(0, 300) || '',
    category: categorizeNews(item.title || ''),
    importance: classifyImportance(item.title || ''),
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    duplicateKey: createDuplicateKey('mlb.com', item.title || '', item.link || ''),
  })).filter((n: Record<string, unknown>) => n.title)
}

async function fetchESPN(): Promise<unknown[]> {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news', {
    headers: { 'User-Agent': 'MLB-Research-Center/1.0' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.articles || []).slice(0, 50).map((article: Record<string, unknown>) => ({
    source: 'espn',
    title: (article.headline || article.title || '') as string,
    url: ((article.links as Record<string, unknown>)?.web as Record<string, unknown>)?.href as string || '',
    summary: ((article.description as string)?.slice(0, 300) || article.headline as string || '') as string,
    category: categorizeNews((article.headline || article.title || '') as string),
    importance: classifyImportance((article.headline || article.title || '') as string),
    publishedAt: article.published ? new Date(article.published as string).toISOString() : new Date().toISOString(),
    duplicateKey: createDuplicateKey('espn', (article.headline || article.title || '') as string, ''),
  })).filter((n: Record<string, unknown>) => n.title)
}

async function fetchFOX(): Promise<unknown[]> {
  const res = await fetch('https://api.foxsports.com/sports-data/v2/sports/baseball/mlb/news?limit=50', {
    headers: { 'User-Agent': 'MLB-Research-Center/1.0' },
  })
  if (!res.ok) return []
  const data = await res.json()
  const articles = data.articles || data.data || []
  return (Array.isArray(articles) ? articles : []).slice(0, 50).map((article: Record<string, unknown>) => ({
    source: 'foxsports',
    title: (article.headline || article.title || '') as string,
    url: (article.url || article.link || '') as string,
    summary: ((article.description as string)?.slice(0, 300) || (article.body as string)?.slice(0, 300) || '') as string,
    category: categorizeNews((article.headline || article.title || '') as string),
    importance: classifyImportance((article.headline || article.title || '') as string),
    publishedAt: (article.publishDate || article.published) ? new Date((article.publishDate || article.published) as string).toISOString() : new Date().toISOString(),
    duplicateKey: createDuplicateKey('foxsports', (article.headline || article.title || '') as string, ''),
  })).filter((n: Record<string, unknown>) => n.title)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'all'
  const errors: string[] = []
  const news: unknown[] = []

  try {
    if (source === 'mlb.com' || source === 'all') {
      const items = await fetchMLBCom()
      news.push(...items)
    }
  } catch (err) {
    errors.push(`mlb.com: ${err instanceof Error ? err.message : 'error'}`)
  }

  try {
    if (source === 'espn' || source === 'all') {
      const items = await fetchESPN()
      news.push(...items)
    }
  } catch (err) {
    errors.push(`espn: ${err instanceof Error ? err.message : 'error'}`)
  }

  try {
    if (source === 'foxsports' || source === 'all') {
      const items = await fetchFOX()
      news.push(...items)
    }
  } catch (err) {
    errors.push(`foxsports: ${err instanceof Error ? err.message : 'error'}`)
  }

  // Deduplicate by title
  const seen = new Set<string>()
  const deduped = news.filter((n) => {
    const key = (n as Record<string, unknown>).duplicateKey as string
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({
    success: true,
    count: deduped.length,
    errors: errors.length > 0 ? errors : undefined,
    news: deduped,
  })
}
