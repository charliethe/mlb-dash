'use client'

import { useState, useEffect } from 'react'
import type { Alert } from '@/types'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCheck } from 'lucide-react'
import { TEAM_LOGOS, MLB_TEAMS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchTeamRoster, fetchTransactions } from '@/lib/mlb/api'
import { getCache, setCache } from '@/lib/cache'
import type { RosterPlayer, Transaction, NewsItem } from '@/types'

const ALERT_COUNT_KEY = 'mlb-alert-count'

function storeAlertCount(count: number) {
  try { localStorage.setItem(ALERT_COUNT_KEY, String(count)) } catch { /* ignore */ }
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  pitcherScratched: 'Pitcher Scratched',
  keyPlayerOut: 'Key Player Out',
  injuryUpdate: 'Injury Update',
  ilMove: 'IL Move',
  trade: 'Trade',
  majorCallUp: 'Major Call-Up',
  closerUnavailable: 'Closer Unavailable',
  postponement: 'Postponed',
  weatherDelay: 'Weather Delay',
  lineupPosted: 'Lineup Posted',
  battingOrderChange: 'Batting Order Change',
  rosterMove: 'Roster Move',
  bullpenConcern: 'Bullpen Concern',
  restingStarters: 'Resting Starters',
  minorUpdate: 'Update',
}

function seenAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem('mlb-alerts-seen')
    return new Set<string>(raw ? JSON.parse(raw) : [])
  } catch { return new Set<string>() }
}

function markAlertSeen(id: string) {
  try {
    const seen = seenAlerts()
    seen.add(id)
    localStorage.setItem('mlb-alerts-seen', JSON.stringify(Array.from(seen)))
  } catch { /* ignore */ }
}

function markAllSeen(ids: string[]) {
  try {
    localStorage.setItem('mlb-alerts-seen', JSON.stringify(ids))
  } catch { /* ignore */ }
}

function rosterToAlert(p: RosterPlayer, teamAbbr: string): Alert | null {
  if (!p.status || !p.status.startsWith('il')) return null
  const id = `il-${p.playerId}-${String(p.status)}`
  return {
    id,
    type: 'ilMove',
    teamId: undefined,
    teamAbbreviation: teamAbbr,
    playerId: p.playerId,
    playerName: p.fullName,
    title: `${p.fullName} placed on IL`,
    reason: `${p.position} — ${p.status.toUpperCase()}`,
    importance: 'high',
    createdAt: new Date().toISOString(),
    readStatus: seenAlerts().has(id),
    sourceUrl: undefined,
  }
}

function transactionToAlert(tx: Transaction): Alert | null {
  const importanceMap: Record<string, 'high' | 'medium'> = {
    traded: 'high',
    callUp: 'high',
    freeAgentSigning: 'high',
    dfa: 'medium',
    ilPlacement: 'high',
    ilActivation: 'medium',
    signed: 'medium',
    released: 'medium',
  }
  const imp = importanceMap[tx.type]
  if (!imp) return null
  return {
    id: `tx-${tx.id}`,
    type: tx.type === 'traded' ? 'trade' : tx.type === 'callUp' ? 'majorCallUp' : 'rosterMove',
    teamId: tx.team.id,
    teamAbbreviation: tx.team.abbreviation,
    playerId: tx.player.id,
    playerName: tx.player.fullName,
    title: tx.description || `${tx.player.fullName} — ${tx.type}`,
    reason: `${tx.team.abbreviation} ${tx.type}`,
    importance: imp,
    createdAt: tx.date,
    readStatus: seenAlerts().has(`tx-${tx.id}`),
    sourceUrl: undefined,
  }
}

function newsToAlert(item: NewsItem): Alert | null {
  if (item.importance !== 'high') return null
  const typeMap: Record<string, Alert['type']> = {
    injury: 'injuryUpdate',
    rosterMove: 'rosterMove',
    trade: 'trade',
    pitcherChange: 'pitcherScratched',
    callUp: 'majorCallUp',
  }
  return {
    id: `news-${item.id}`,
    type: typeMap[item.category] || 'minorUpdate',
    teamId: item.teamId,
    teamAbbreviation: item.teamAbbreviation,
    playerId: undefined,
    playerName: undefined,
    title: item.title,
    reason: item.source,
    importance: 'high',
    createdAt: item.publishedAt,
    readStatus: seenAlerts().has(`news-${item.id}`),
    sourceUrl: item.url,
  }
}

export function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadAlerts()
  }, [])

  async function loadAlerts() {
    setLoading(true)
    setError(false)
    try {
      const cached = getCache<Alert[]>('live-alerts')
      if (cached) {
        setAlerts(cached.map((a) => ({ ...a, readStatus: seenAlerts().has(a.id) })))
        setLoading(false)
        return
      }

      const teams = Object.entries(MLB_TEAMS)

      const rosters: RosterPlayer[][] = []
      const BATCH_SIZE = 5
      for (let i = 0; i < teams.length; i += BATCH_SIZE) {
        const batch = teams.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map(([id]) => fetchTeamRoster(Number(id)).catch(() => [] as RosterPlayer[]))
        )
        rosters.push(...results)
        if (i + BATCH_SIZE < teams.length) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }

      const [txs, newsRes] = await Promise.all([
        fetchTransactions().catch(() => [] as Transaction[]),
        fetch('/api/news?source=all').then((r) => r.json()).catch(() => ({ news: [] as NewsItem[] })),
      ])

      const result: Alert[] = []

      for (let i = 0; i < teams.length; i++) {
        const [, info] = teams[i]
        for (const p of rosters[i]) {
          const a = rosterToAlert(p, info.abbreviation)
          if (a) result.push(a)
        }
      }

      for (const tx of txs) {
        const a = transactionToAlert(tx)
        if (a) result.push(a)
      }

      const newsItems: NewsItem[] = newsRes.news || []
      for (const item of newsItems) {
        const a = newsToAlert(item)
        if (a) result.push(a)
      }

      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setAlerts(result)
      storeAlertCount(result.filter((a) => !a.readStatus).length)
      setCache('live-alerts', result, 15)
    } catch (err) {
      console.error('Failed to load alerts:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function markRead(id: string) {
    markAlertSeen(id)
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, readStatus: true } : a))
  }

  function markAllRead() {
    const ids = alerts.map((a) => a.id)
    markAllSeen(ids)
    setAlerts((prev) => prev.map((a) => ({ ...a, readStatus: true })))
  }

  const unread = alerts.filter((a) => !a.readStatus)
  const filtered = (filter === 'all' ? alerts : alerts.filter((a) => a.importance === filter)).filter((a) => !a.readStatus)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Alerts {unread.length > 0 && <span className="text-muted-foreground font-normal">({unread.length})</span>}</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'high' | 'medium')} className="w-auto">
              <TabsList className="h-7">
                <TabsTrigger value="all" className="text-[11px] px-2 py-1 h-7">All</TabsTrigger>
                <TabsTrigger value="high" className="text-[11px] px-2 py-1 h-7">High</TabsTrigger>
                <TabsTrigger value="medium" className="text-[11px] px-2 py-1 h-7">Medium</TabsTrigger>
              </TabsList>
            </Tabs>
            {unread.length > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs gap-1">
                <CheckCheck className="h-3 w-3" /> Mark All Read
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="h-4 w-4 shrink-0 mt-0.5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load alerts</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadAlerts}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No alerts. You&apos;re up to date.</div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border" aria-live="polite" aria-atomic="true">
              {filtered.map((alert) => (
                <div key={alert.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {alert.teamAbbreviation && TEAM_LOGOS[alert.teamAbbreviation] && (
                          <LogoImage src={TEAM_LOGOS[alert.teamAbbreviation]} alt={`${alert.teamAbbreviation} logo`} className="h-4 w-4" />
                        )}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                          alert.importance === 'high' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                          'border-amber-500/30 text-amber-400 bg-amber-500/10'
                        }`}>
                          {alert.importance.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {ALERT_TYPE_LABELS[alert.type] || alert.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      {alert.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.reason}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {alert.teamAbbreviation && (
                          <span className="text-[11px] text-muted-foreground font-medium">{alert.teamAbbreviation}</span>
                        )}
                        {alert.playerName && (
                          <span className="text-[11px] text-muted-foreground">{alert.playerName}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {alert.createdAt ? format(parseISO(alert.createdAt), 'MMM d, h:mm a') : ''}
                        </span>
                        {alert.sourceUrl && (
                          <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline ml-auto">Source</a>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Mark alert as read" onClick={() => markRead(alert.id)}>
                      <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
