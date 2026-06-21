'use client'

import { useState, useEffect } from 'react'
import type { DailyLogEntry } from '@/types'
import { getDailyLog } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, Download } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const IMPORTANCE_COLORS: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-muted',
}

const PAGE_SIZE = 50

export function DailyLog({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [entries, setEntries] = useState<DailyLogEntry[]>([])
  const [filtered, setFiltered] = useState<DailyLogEntry[]>([])
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadLog()
  }, [startDate, endDate])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!search.trim()) {
        setFiltered(entries)
      } else {
        const q = search.toLowerCase()
        setFiltered(entries.filter((e) => e.text.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)))
      }
      setDisplayCount(PAGE_SIZE)
    })
    return () => { cancelled = true }
  }, [entries, search])

  async function loadLog() {
    setLoading(true)
    setError(false)
    try {
      const data = await getDailyLog(startDate, endDate)
      setEntries(data.toReversed())
      setFiltered(data.toReversed())
    } catch (err) {
      console.error('Failed to load daily log:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function generateLog() {
    setGenerating(true)
    try {
      await fetch(`/api/log/generate${startDate ? `?date=${startDate}` : ''}`)
      await loadLog()
    } catch (err) {
      console.error('Failed to generate log:', err)
    } finally {
      setGenerating(false)
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

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium">Daily MLB Log</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={generateLog} disabled={generating}>
              <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
              Generate
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
            <p className="text-muted-foreground mb-3">No entries{startDate ? ` for ${startDate}${endDate && endDate !== startDate ? ` – ${endDate}` : ''}` : ' yet today'}</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
              Click <strong>Generate</strong> above to auto-create entries from today&apos;s games, transactions, and news. Or wait for the research worker to populate this automatically.
            </p>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={generateLog} disabled={generating}>
              <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
              Generate Now
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-0">
              {filtered.slice(0, displayCount).map((entry) => (
                <div
                  key={entry.id}
                  className={`px-4 py-2.5 border-l-2 ${IMPORTANCE_COLORS[entry.importance] || 'border-l-muted'} hover:bg-muted/30 transition-colors`}
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
