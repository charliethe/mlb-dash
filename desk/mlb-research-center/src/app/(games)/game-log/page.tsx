'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchPlayerGameLog, fetchPlayerInfo } from '@/lib/mlb/api'
import type { GameLogEntry, MLBPlayer } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { format, parseISO } from 'date-fns'
import { Search, Table2 } from 'lucide-react'
import { CsvExportButton } from '@/components/ui/csv-export-button'

export default function GameLogPage() {
  useEffect(() => { document.title = 'Game Log — MLB Research' }, [])
  return (
    <ErrorBoundary name="GameLog">
      <GameLogInner />
    </ErrorBoundary>
  )
}

function GameLogInner() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; name: string; team?: string }[]>([])
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [player, setPlayer] = useState<MLBPlayer | null>(null)
  const [entries, setEntries] = useState<GameLogEntry[]>([])
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
    loadGameLog(playerId)
  }, [playerId])

  async function loadGameLog(id: number) {
    setLoading(true)
    setError(false)
    try {
      const [playerInfo, log] = await Promise.all([
        fetchPlayerInfo(id),
        fetchPlayerGameLog(id, 162),
      ])
      setPlayer(playerInfo)
      setEntries(log)
      setLastUpdated(new Date())
    } catch {
      setError(true)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const batterEntries = useMemo(() => entries.filter((e) => e.type === 'hitting'), [entries])
  const pitcherEntries = useMemo(() => entries.filter((e) => e.type === 'pitching'), [entries])
  const hasBatting = batterEntries.length > 0
  const hasPitching = pitcherEntries.length > 0

  const seasonStats = useMemo(() => {
    if (hasBatting) {
      const games = batterEntries.filter((e) => e.ab != null)
      const ab = games.reduce((s, e) => s + (e.ab || 0), 0)
      const hits = games.reduce((s, e) => s + (e.hits || 0), 0)
      const hr = games.reduce((s, e) => s + (e.homeRuns || 0), 0)
      const rbi = games.reduce((s, e) => s + (e.rbi || 0), 0)
      const runs = games.reduce((s, e) => s + (e.runs || 0), 0)
      const bb = games.reduce((s, e) => s + (e.walks || 0), 0)
      const k = games.reduce((s, e) => s + (e.strikeouts || 0), 0)
      return { ab, hits, hr, rbi, runs, bb, k, avg: ab > 0 ? (hits / ab).toFixed(3) : '-', games: games.length }
    }
    if (hasPitching) {
      const games = pitcherEntries.filter((e) => e.inningsPitched != null)
      const ip = games.reduce((s, e) => {
        const ipStr = e.inningsPitched || '0'
        const parts = ipStr.split('.')
        return s + parseInt(parts[0]) + (parts[1] ? parseInt(parts[1]) / 3 : 0)
      }, 0)
      const er = games.reduce((s, e) => s + (e.earnedRuns || 0), 0)
      const k = games.reduce((s, e) => s + (e.strikeouts || 0), 0)
      const bb = games.reduce((s, e) => s + (e.walks || 0), 0)
      const hits = games.reduce((s, e) => s + (e.hits || 0), 0)
      const era = ip > 0 ? ((er / ip) * 9).toFixed(2) : '-'
      return { ip: ip.toFixed(1), era, k, bb, hits, er, games: games.length }
    }
    return null
  }, [batterEntries, pitcherEntries])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          Game Log
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
            Search for a player above to view their game-by-game stats for the current season.
          </CardContent>
        </Card>
      )}

      {playerId && loading && <CardSkeleton count={8} />}

      {playerId && !loading && error && (
        <ErrorState message="Failed to load game log" onRetry={() => playerId && loadGameLog(playerId)} />
      )}

      {playerId && !loading && !error && entries.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground text-center">No game log data available for this player.</CardContent>
        </Card>
      )}

      {playerId && !loading && !error && entries.length > 0 && (
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
                  {seasonStats && (
                    <div className="ml-auto flex items-center gap-4 text-xs">
                      {hasBatting && 'avg' in seasonStats && (
                        <>
                          <span className="text-muted-foreground">{seasonStats.games} G</span>
                          <span className="text-muted-foreground">{seasonStats.ab} AB</span>
                          <span className="font-medium">{seasonStats.avg}</span>
                          <span className="font-medium">{seasonStats.hr} HR</span>
                          <span className="font-medium">{seasonStats.rbi} RBI</span>
                        </>
                      )}
                      {hasPitching && 'ip' in seasonStats && (
                        <>
                          <span className="text-muted-foreground">{seasonStats.games} G</span>
                          <span className="font-medium">{seasonStats.ip} IP</span>
                          <span className="font-medium">{seasonStats.era} ERA</span>
                          <span className="font-medium">{seasonStats.k} K</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
              <CsvExportButton
                filename={`game_log_${player?.fullName?.replace(/\s+/g, '_') || 'player'}`}
                headers={
                  hasBatting
                    ? ['Date', 'Opp', 'Result', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', 'AVG']
                    : ['Date', 'Opp', 'Result', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'Note']
                }
                rows={entries.map((e) => {
                  const date = format(parseISO(e.date), 'MMM d')
                  if (e.type === 'hitting') {
                    return [date, e.opponent, e.isWin ? 'W' : 'L', e.ab ?? '', e.runs ?? '', e.hits ?? '', e.rbi ?? '', e.homeRuns ?? '', e.walks ?? '', e.strikeouts ?? '', e.avg ?? '']
                  }
                  return [date, e.opponent, e.isWin ? 'W' : 'L', e.inningsPitched ?? '', e.hits ?? '', e.runs ?? '', e.earnedRuns ?? '', e.walks ?? '', e.strikeouts ?? '', e.note ?? '']
                })}
              />
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Opp</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Result</th>
                    {hasBatting && (
                      <>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">AB</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">R</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">H</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">RBI</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">HR</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">BB</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">K</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">AVG</th>
                      </>
                    )}
                    {hasPitching && (
                      <>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">IP</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">H</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">R</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">ER</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">BB</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">K</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground">Note</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={`${e.date}-${i}`} className={`border-b border-border hover:bg-muted/30 transition-colors ${e.isWin ? 'bg-green-500/5' : ''}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {format(parseISO(e.date), 'MMM d')}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {e.isHome ? (
                            <span className="text-[10px] text-muted-foreground font-medium">vs</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium">@</span>
                          )}
                          <span className="text-xs font-medium truncate max-w-[80px]">{e.opponent}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {e.isWin ? (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500/30 text-green-400 bg-green-500/10">W</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-500/30 text-red-400 bg-red-500/10">L</Badge>
                        )}
                      </td>
                      {e.type === 'hitting' && (
                        <>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.ab ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.runs ?? '-'}</td>
                          <td className={`px-2 py-2 text-right tabular-nums text-xs font-medium ${e.hits && e.hits >= 2 ? 'text-green-400' : ''}`}>
                            {e.hits ?? '-'}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.rbi ?? '-'}</td>
                          <td className={`px-2 py-2 text-right tabular-nums text-xs font-medium ${e.homeRuns ? 'text-amber-400' : ''}`}>
                            {e.homeRuns ?? '-'}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.walks ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.strikeouts ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs text-muted-foreground">{e.avg || '-'}</td>
                        </>
                      )}
                      {e.type === 'pitching' && (
                        <>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.inningsPitched ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.hits ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.runs ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.earnedRuns ?? '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-xs">{e.walks ?? '-'}</td>
                          <td className={`px-2 py-2 text-right tabular-nums text-xs font-medium ${e.strikeouts && e.strikeouts >= 7 ? 'text-amber-400' : ''}`}>
                            {e.strikeouts ?? '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-xs text-muted-foreground max-w-[100px] truncate">{e.note || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <ScrollToTop />
    </div>
  )
}
