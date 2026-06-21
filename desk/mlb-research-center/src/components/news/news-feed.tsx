'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { NewsItem, NewsCategory, NewsSource } from '@/types'
import { getRecentNews } from '@/lib/supabase/client'
import { fetchMLBNews } from '@/lib/rss/fetcher'
import { insertNewsItems } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExternalLink } from 'lucide-react'
import { TEAM_LOGOS, TEAM_COLORS, MLB_TEAMS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isSourceEnabled } from '@/lib/settings'

const CATEGORIES: { label: string; value: NewsCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Injury', value: 'injury' },
  { label: 'Roster', value: 'rosterMove' },
  { label: 'Lineup', value: 'lineup' },
  { label: 'Trade', value: 'trade' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Pitcher', value: 'pitcherChange' },
  { label: 'Recap', value: 'recap' },
  { label: 'Preview', value: 'preview' },
]

const SOURCE_COLORS: Record<string, string> = {
  'mlb.com': 'border-blue-500/30 text-blue-400 bg-blue-500/5',
  'espn': 'border-red-500/30 text-red-400 bg-red-500/5',
  'foxsports': 'border-green-500/30 text-green-400 bg-green-500/5',
}

const SOURCES: { label: string; value: NewsSource | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'MLB.com', value: 'mlb.com' },
  { label: 'ESPN', value: 'espn' },
  { label: 'FOX', value: 'foxsports' },
]

const PAGE_SIZE = 50

export function NewsFeed() {
  const [allNews, setAllNews] = useState<NewsItem[]>([])
  const [error, setError] = useState(false)
  const [filtered, setFiltered] = useState<NewsItem[]>([])
  const [category, setCategory] = useState<NewsCategory | 'all'>('all')
  const [source, setSource] = useState<NewsSource | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const params = new URLSearchParams(window.location.search)
      const cat = params.get('category')
      const src = params.get('source')
      const team = params.get('team')
      if (cat) setCategory(cat as NewsCategory | 'all')
      if (src) setSource(src as NewsSource | 'all')
      if (team) setTeamFilter(team)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (source !== 'all') params.set('source', source)
    if (teamFilter !== 'all') params.set('team', teamFilter)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [category, source, teamFilter, router, pathname])

  async function loadNews() {
    setLoading(true)
    setError(false)
    try {
      let items = await getRecentNews(100)
      if (items.length < 20) {
        const fetched = await fetchMLBNews()
        await insertNewsItems(fetched)
        items = await getRecentNews(100)
      }
      setAllNews(items)
    } catch (err) {
      console.error('Failed to load news:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(false)
      try {
        let items = await getRecentNews(100)
        if (items.length < 20) {
          const fetched = await fetchMLBNews()
          await insertNewsItems(fetched)
          items = await getRecentNews(100)
        }
        if (!cancelled) setAllNews(items)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load news:', err)
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filterNews = useCallback(() => {
    let result = allNews.filter((n) => isSourceEnabled(n.source))
    if (category !== 'all') {
      result = result.filter((n) => n.category === category)
    }
    if (source !== 'all') {
      result = result.filter((n) => n.source === source)
    }
    if (teamFilter !== 'all') {
      result = result.filter((n) => n.teamAbbreviation === teamFilter)
    }
    setFiltered(result)
  }, [allNews, category, source, teamFilter])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) filterNews()
    })
    return () => { cancelled = true }
  }, [filterNews])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setDisplayCount(PAGE_SIZE)
    })
    return () => { cancelled = true }
  }, [filtered])

  const uniqueTeams = [...new Set(allNews.map((n) => n.teamAbbreviation).filter(Boolean))] as string[]
  const teamOptions = uniqueTeams
    .map((abbr) => ({
      abbr,
      name: Object.values(MLB_TEAMS).find((t) => t.abbreviation === abbr)?.name || abbr,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">News Feed</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={loadNews} disabled={loading}>
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Tabs value={category} onValueChange={(v) => setCategory(v as NewsCategory | 'all')} className="w-auto">
            <TabsList className="h-7 overflow-x-auto">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value} className="text-[11px] px-2 py-1 h-7 whitespace-nowrap">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          <Tabs value={source} onValueChange={(v) => setSource(v as NewsSource | 'all')} className="w-auto">
            <TabsList className="h-7">
              {SOURCES.map((s) => (
                <TabsTrigger key={s.value} value={s.value} className="text-[11px] px-2 py-1 h-7">
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {teamOptions.length > 0 && (
            <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v || 'all')}>
              <SelectTrigger className="h-7 text-xs w-[130px]" aria-label="Filter by team">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All teams</SelectItem>
                {teamOptions.map((t) => (
                  <SelectItem key={t.abbr} value={t.abbr} className="text-xs">
                    {t.abbr} — {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="h-4 w-4 shrink-0 mt-0.5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load news</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadNews}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-center">
            <p className="text-muted-foreground">No news items match your filters</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting the category, source, or team filter above</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {filtered.slice(0, displayCount).map((item) => (
                <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition-colors" style={item.teamAbbreviation && TEAM_COLORS[item.teamAbbreviation] ? { borderLeft: `3px solid ${TEAM_COLORS[item.teamAbbreviation]}50` } : undefined}>
                  <div className="flex items-start gap-2 mb-1">
                    {item.teamAbbreviation && TEAM_LOGOS[item.teamAbbreviation] && (
                      <LogoImage src={TEAM_LOGOS[item.teamAbbreviation]} alt={`${item.teamAbbreviation} logo`} className="h-4 w-4 mt-0.5" />
                    )}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      item.importance === 'high' ? 'border-red-500/30 text-red-400' :
                      item.importance === 'medium' ? 'border-amber-500/30 text-amber-400' :
                      'border-blue-500/30 text-blue-400'
                    }`}>
                      {item.category}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SOURCE_COLORS[item.source] || 'border-muted text-muted-foreground'}`}>
                      {item.source}
                    </Badge>
                    {item.teamAbbreviation && (
                      <span className="text-[10px] text-muted-foreground ml-auto font-medium">{item.teamAbbreviation}</span>
                    )}
                  </div>
                  <p className="text-sm leading-snug">{item.title}</p>
                  {item.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {item.publishedAt ? format(parseISO(item.publishedAt), 'MMM d, h:mm a') : ''}
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Read <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filtered.length > displayCount && (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}>
                  Load More
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
