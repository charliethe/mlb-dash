'use client'

import { useState, useEffect } from 'react'
import type { DailyLogEntry, MLBGame, Transaction, NewsItem } from '@/types'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, Download } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchTodayGames, fetchTransactions } from '@/lib/mlb/api'
import { getCache, setCache } from '@/lib/cache'

const PAGE_SIZE = 50

function gameToEntry(game: MLBGame, date: string): DailyLogEntry {
  const isFinal = game.status.abstractGameState === 'Final'
  const isLive = game.status.abstractGameState === 'Live'
  const away = game.teams.away.team.abbreviation
  const home = game.teams.home.team.abbreviation
  let text: string
  let importance: 'high' | 'medium' | 'low'
  if (isFinal) {
    text = `${away} ${game.teams.away.score ?? '-'} @ ${home} ${game.teams.home.score ?? '-'} — Final`
    importance = 'low'
  } else if (isLive) {
    text = `${away} ${game.teams.away.score ?? 0} @ ${home} ${game.teams.home.score ?? 0} — ${game.status.detailedState || 'In Progress'}`
    importance = 'medium'
  } else {
    text = `${away} @ ${home} — ${format(parseISO(game.gameDate), 'h:mm a')}`
    importance = 'low'
  }
  return {
    id: `game-${game.gamePk}`,
    date,
    category: 'gameNote',
    text,
    sourceUrl: undefined,
    importance,
    createdAt: game.gameDate,
  }
}

function transactionToEntry(tx: Transaction): DailyLogEntry {
  const importanceMap: Record<string, 'high' | 'medium' | 'low'> = {
    traded: 'high',
    callUp: 'high',
    freeAgentSigning: 'high',
    dfa: 'medium',
    ilPlacement: 'high',
    ilActivation: 'medium',
    signed: 'medium',
    released: 'medium',
    optioned: 'low',
    waiverClaim: 'medium',
    purchase: 'low',
    other: 'low',
  }
  return {
    id: `tx-${tx.id}`,
    date: tx.date.split('T')[0],
    category: 'transaction',
    text: `${tx.team.abbreviation}: ${tx.description || `${tx.player.fullName} — ${tx.type}`}`,
    sourceUrl: undefined,
    importance: importanceMap[tx.type] || 'low',
    createdAt: tx.date,
  }
}

function newsToEntry(item: NewsItem): DailyLogEntry {
  const catMap: Record<string, DailyLogEntry['category']> = {
    injury: 'injury', rosterMove: 'rosterMove', trade: 'trade', lineup: 'lineup',
    pitcherChange: 'pitcherChange', callUp: 'callUp', recap: 'recap',
  }
  return {
    id: `news-${item.id}`,
    date: item.publishedAt.split('T')[0],
    category: catMap[item.category] || 'researchNote',
    text: item.title,
    sourceUrl: item.url,
    importance: item.importance,
    createdAt: item.publishedAt,
  }
}

export function DailyLog({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [entries, setEntries] = useState<DailyLogEntry[]>([])
  const [filtered, setFiltered] = useState<DailyLogEntry[]>([])
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadLog()
  }, [startDate, endDate])

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(entries)
    } else {
      const q = search.toLowerCase()
      setFiltered(entries.filter((e) => e.text.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)))
    }
    setDisplayCount(PAGE_SIZE)
  }, [entries, search])

  async function loadLog() {
    setLoading(true)
    setError(false)
    try {
      const cacheKey = `daily-log-${startDate}-${endDate}`
      const cached = getCache<DailyLogEntry[]>(cacheKey)
      if (cached) {
        setEntries(cached)
        setLoading(false)
        return
      }

      const date = startDate || new Date().toISOString().split('T')[0]
      const [games, txs, newsRes] = await Promise.all([
        fetchTodayGames(date),
        fetchTransactions(date, endDate || date),
        fetch(`/api/news${startDate ? `?date=${startDate}` : ''}`).then((r) => r.json()).catch(() => ({ news: [] })),
      ])

      const result: DailyLogEntry[] = [
        ...games.map((g) => gameToEntry(g, date)),
        ...txs.map(transactionToEntry),
        ...((newsRes.news || []) as NewsItem[]).map(newsToEntry),
      ]

      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setEntries(result)
      setCache(cacheKey, result, 5)
    } catch (err) {
      console.error('Failed to load daily log:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function exportLog() {
    const text = entries
      .map((e) => `[${format(parseISO(e.createdAt), 'h:mm a')}] [${e.category.toUpperCase()}] ${e.text}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mlb-log-${(startDate || new Date().toISOString().split('T')[0])}${endDate ? `--${endDate}` : ''}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importanceColors: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-muted',
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium">Daily MLB Log</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadLog} disabled={loading}>
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportLog} disabled={entries.length === 0}>
              <Download className="h-3 w-3" />
              Export
            </Button>
            <div className="relative w-48 max-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search log..."
                aria-label="Search log entries"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-2">
                <Skeleton className="h-3 w-14 shrink-0 mt-1" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load daily log</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadLog}>Retry</Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-sm text-center">
            <p className="text-muted-foreground">No entries for this date range</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-0">
              {filtered.slice(0, displayCount).map((entry) => (
                <div
                  key={entry.id}
                  className={`px-4 py-2.5 border-l-2 ${importanceColors[entry.importance] || 'border-l-muted'} hover:bg-muted/30 transition-colors`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                      {format(parseISO(entry.createdAt), 'h:mm a')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{entry.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                          entry.importance === 'high' ? 'border-red-500/30 text-red-400' :
                          entry.importance === 'medium' ? 'border-amber-500/30 text-amber-400' :
                          'border-blue-500/30 text-blue-400'
                        }`}>
                          {entry.category}
                        </Badge>
                        {entry.sourceUrl && (
                          <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline">
                            Source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {displayCount < filtered.length && (
              <div className="px-4 py-2 text-center">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}>
                  Show {Math.min(PAGE_SIZE, filtered.length - displayCount)} More
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
