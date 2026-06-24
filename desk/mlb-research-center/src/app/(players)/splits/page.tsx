'use client'

import { useState, useEffect } from 'react'
import { fetchPlayerSplits, fetchPlayerInfo } from '@/lib/mlb/api'
import type { MLBPlayer, PlayerSplitsData, VsSplit } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Badge } from '@/components/ui/badge'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Search, GitFork } from 'lucide-react'

const MONTH_ORDER = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT']

const SPLIT_GROUPS: { key: string; label: string; splits: { id: keyof PlayerSplitsData; label: string }[] }[] = [
  {
    key: 'handedness',
    label: 'vs LHP / RHP',
    splits: [
      { id: 'vsLhp', label: 'vs LHP' },
      { id: 'vsRhp', label: 'vs RHP' },
    ],
  },
  {
    key: 'venue',
    label: 'Home / Away',
    splits: [
      { id: 'home', label: 'Home' },
      { id: 'away', label: 'Away' },
    ],
  },
  {
    key: 'time',
    label: 'Day / Night',
    splits: [
      { id: 'day', label: 'Day' },
      { id: 'night', label: 'Night' },
    ],
  },
]

export default function SplitsPage() {
  useEffect(() => { document.title = 'Splits Explorer — MLB Research' }, [])
  return (
    <ErrorBoundary name="SplitsExplorer">
      <SplitsInner />
    </ErrorBoundary>
  )
}

function SplitsInner() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; name: string; team?: string }[]>([])
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [player, setPlayer] = useState<MLBPlayer | null>(null)
  const [splits, setSplits] = useState<PlayerSplitsData>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/player-search?q=${encodeURIComponent(query)}`)
        if (!res.ok) return
        const data = await res.json()
        setResults((data.players || []).slice(0, 15))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!playerId) return
    loadSplits(playerId)
  }, [playerId])

  async function loadSplits(id: number) {
    setLoading(true)
    setError(false)
    try {
      const [playerInfo, splitData] = await Promise.all([
        fetchPlayerInfo(id),
        fetchPlayerSplits(id),
      ])
      setPlayer(playerInfo)
      setSplits(splitData)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function renderSplitCard(title: string, splitDefs: { id: keyof PlayerSplitsData; label: string }[]) {
    if (splitDefs.length === 0) return null
    const available = splitDefs.filter((s) => splitsData(s.id) != null)
    if (available.length === 0) return null

    return (
      <Card key={title}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Split</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">AB</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">H</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">AVG</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">HR</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">RBI</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">OBP</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">SLG</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">OPS</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">BB</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">K</th>
                </tr>
              </thead>
              <tbody>
                {available.map((s) => {
                  const data = splitsData(s.id)
                  if (!data) return null
                  return (
                    <tr key={s.id as string} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 text-xs font-medium">{s.label}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{data.ab ?? '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{data.hits ?? '-'}</td>
                      <td className={`px-2 py-2 text-right tabular-nums text-xs font-mono ${data.avg ? '' : 'text-muted-foreground'}`}>
                        {data.avg ? data.avg.startsWith('.') ? data.avg : `.${data.avg}` : '-'}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{data.homeRuns ?? '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{data.rbi ?? '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs font-mono">{data.obp || '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs font-mono">{data.slg || '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs font-mono font-medium">{data.ops || '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{data.walks ?? '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">{data.strikeouts ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  function splitsData(id: keyof PlayerSplitsData): VsSplit | undefined {
    if (id === 'vsLhp') return splits.vsLhp
    if (id === 'vsRhp') return splits.vsRhp
    if (id === 'home') return splits.home
    if (id === 'away') return splits.away
    if (id === 'day') return splits.day
    if (id === 'night') return splits.night
    return undefined
  }

  function monthSplitsData(month: string): VsSplit | undefined {
    return splits.months?.[month]
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <GitFork className="h-4 w-4 text-muted-foreground" />
          Splits Explorer
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for a player..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            )}
          </div>
          {results.length > 0 && (
            <div className="mt-2 border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/30 transition-colors flex items-center gap-2"
                  onClick={() => {
                    setPlayerId(p.id)
                    setQuery('')
                    setResults([])
                  }}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.team && <span className="text-xs text-muted-foreground ml-auto">{p.team}</span>}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

      {!playerId && (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            Search for a player above to view their hitting splits for the current season.
          </CardContent>
        </Card>
      )}

      {playerId && loading && <CardSkeleton count={6} />}

      {playerId && !loading && error && (
        <ErrorState message="Failed to load splits" onRetry={() => playerId && loadSplits(playerId)} />
      )}

      {playerId && !loading && !error && (
        <>
          {player && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 shrink-0">
                    <img
                      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_80,q_auto:best/v1/people/${player.id}/headshot/silo/current`}
                      alt={player.fullName}
                      className="w-10 h-10 rounded-full object-cover bg-muted"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{player.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {player.primaryPosition} — {player.currentTeam?.abbreviation || ''} {player.bats}/{player.throws}
                    </div>
                  </div>
                  {splits.vsLhp && splits.vsRhp && (
                    <div className="ml-auto flex items-center gap-4 text-xs">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${splits.vsLhp.avg && splits.vsRhp.avg && parseFloat(splits.vsLhp.avg) > parseFloat(splits.vsRhp.avg) ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
                        vs LHP: {splits.vsLhp.avg || '-'}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${splits.vsRhp.avg && splits.vsLhp.avg && parseFloat(splits.vsRhp.avg) > parseFloat(splits.vsLhp.avg) ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
                        vs RHP: {splits.vsRhp.avg || '-'}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {SPLIT_GROUPS.map((group) => renderSplitCard(group.label, group.splits))}

          {splits.months && Object.keys(splits.months).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Month-by-Month</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Month</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">AB</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">H</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">AVG</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">HR</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">RBI</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">OPS</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">BB</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTH_ORDER.filter((m) => splits.months?.[m]).map((month) => {
                        const data = monthSplitsData(month)!
                        return (
                          <tr key={month} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 text-xs font-medium">{month}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">{data.ab ?? '-'}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">{data.hits ?? '-'}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs font-mono">
                              {data.avg ? (data.avg.startsWith('.') ? data.avg : `.${data.avg}`) : '-'}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">{data.homeRuns ?? '-'}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">{data.rbi ?? '-'}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs font-mono font-medium">{data.ops || '-'}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">{data.walks ?? '-'}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">{data.strikeouts ?? '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!splits.vsLhp && !splits.vsRhp && !splits.home && !splits.away && !splits.day && !splits.night && !splits.months && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground text-center">
                No split data available for this player.
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ScrollToTop />
    </div>
  )
}
