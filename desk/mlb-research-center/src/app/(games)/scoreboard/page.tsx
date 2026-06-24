'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchTodayGames } from '@/lib/mlb/api'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GameDetailDialog } from '@/components/game/game-detail-dialog'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Radio, Grid3x3 } from 'lucide-react'
import { CsvExportButton } from '@/components/ui/csv-export-button'
import { format, parseISO } from 'date-fns'
import type { MLBGame } from '@/types'

interface LinescoreInning {
  num: number
  away: { runs: number; hits: number; errors: number }
  home: { runs: number; hits: number; errors: number }
}

export default function ScoreboardPage() {
  useEffect(() => { document.title = 'Scoreboard — MLB Research' }, [])
  return (
    <ErrorBoundary name="Scoreboard">
      <ScoreboardInner />
    </ErrorBoundary>
  )
}

function ScoreboardInner() {
  const [games, setGames] = useState<MLBGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedGame, setSelectedGame] = useState<MLBGame | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [linescores, setLinescores] = useState<Map<number, LinescoreInning[]>>(new Map())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasLive = games.some((g) => g.status.abstractGameState === 'Live')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
      return
    }
    pollingRef.current = setInterval(async () => {
      try {
        const data = await fetchTodayGames()
        setGames(data)
        setLastUpdated(new Date())
        loadLinescores(data.filter(g => g.status.abstractGameState !== 'Preview'))
      } catch { /* silent */ }
    }, 30000)
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }
  }, [autoRefresh])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchTodayGames()
      setGames(data)
      setLastUpdated(new Date())
      loadLinescores(data.filter(g => g.status.abstractGameState !== 'Preview'))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function loadLinescores(gameList: MLBGame[]) {
    const map = new Map(linescores)
    for (const g of gameList) {
      if (map.has(g.gamePk)) continue
      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/linescore`)
        if (res.ok) {
          const data = await res.json()
          if (data?.innings) {
            map.set(g.gamePk, data.innings.map((i: Record<string, unknown>) => ({
              num: i.num as number,
              away: i.away as LinescoreInning['away'],
              home: i.home as LinescoreInning['home'],
            })))
          }
        }
      } catch { /* silent */ }
    }
    setLinescores(map)
  }

  const live = games.filter(g => g.status.abstractGameState === 'Live')
  const preview = games.filter(g => g.status.abstractGameState === 'Preview')
  const final = games.filter(g => g.status.abstractGameState === 'Final')

  const maxInnings = Math.max(9, ...Array.from(linescores.values()).map(innings => innings.length))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Scoreboard</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasLive && (
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs gap-1.5 ${autoRefresh ? 'animate-pulse border-green-500' : ''}`}
              onClick={() => setAutoRefresh(c => !c)}
            >
              <Radio className={`h-3 w-3 ${autoRefresh ? 'text-green-400' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
          )}
          <CsvExportButton
            filename="scoreboard"
            headers={['Status', 'Away', 'Home', 'Away Score', 'Home Score', 'Venue', 'Date']}
            rows={games.map((g) => {
              const aScore = g.teams.away.score ?? ''
              const hScore = g.teams.home.score ?? ''
              return [g.status.abstractGameState, g.teams.away.team.abbreviation, g.teams.home.team.abbreviation, aScore, hScore, g.venue || '', g.gameDate.split('T')[0]]
            })}
          />
          <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadData} />
        </div>
      </div>

      {(loading || error) && (
        <Card>
          <CardContent className="p-4">
            {loading ? <CardSkeleton count={3} /> : <ErrorState message="Failed to load scoreboard" onRetry={loadData} />}
          </CardContent>
        </Card>
      )}

      {!loading && !error && games.length === 0 && (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">No games scheduled today</CardContent>
        </Card>
      )}

      {live.length > 0 && <Section title={`Live (${live.length})`} games={live} linescores={linescores} maxInnings={maxInnings} onSelect={setSelectedGame} />}
      {preview.length > 0 && <Section title={`Upcoming (${preview.length})`} games={preview} linescores={linescores} maxInnings={maxInnings} onSelect={setSelectedGame} />}
      {final.length > 0 && <Section title={`Final (${final.length})`} games={final} linescores={linescores} maxInnings={maxInnings} onSelect={setSelectedGame} />}

      {selectedGame && (
        <GameDetailDialog game={selectedGame} open={!!selectedGame} onOpenChange={(o) => { if (!o) setSelectedGame(null) }} />
      )}
      <ScrollToTop />
    </div>
  )
}

function Section({ title, games, linescores, maxInnings, onSelect }: {
  title: string
  games: MLBGame[]
  linescores: Map<number, LinescoreInning[]>
  maxInnings: number
  onSelect: (g: MLBGame) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="sticky left-0 bg-muted/20 z-10 px-2 py-1.5 text-left font-medium text-muted-foreground w-8"></th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Team</th>
              {Array.from({ length: maxInnings }, (_, i) => (
                <th key={i} className="px-1.5 py-1.5 text-center font-mono text-muted-foreground font-medium w-6">{i + 1}</th>
              ))}
              <th className="px-1.5 py-1.5 text-center font-mono text-muted-foreground font-medium w-6">R</th>
              <th className="px-1.5 py-1.5 text-center font-mono text-muted-foreground font-medium w-6">H</th>
              <th className="px-1.5 py-1.5 text-center font-mono text-muted-foreground font-medium w-6">E</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Pitcher</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Venue</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => {
              const innings = linescores.get(game.gamePk) || []
              const isLive = game.status.abstractGameState === 'Live'
              const isFinal = game.status.abstractGameState === 'Final'
              const totalRunsA = innings.reduce((s, i) => s + (i.away.runs ?? 0), 0)
              const totalRunsH = innings.reduce((s, i) => s + (i.home.runs ?? 0), 0)
              const lastInning = innings[innings.length - 1]
              const totalHitsA = lastInning?.away.hits
              const totalHitsH = lastInning?.home.hits
              const totalErrA = lastInning?.away.errors
              const totalErrH = lastInning?.home.errors

              const rows = [
                { label: game.teams.away.team.abbreviation, logo: TEAM_LOGOS[game.teams.away.team.abbreviation], side: 'away' as const },
                { label: game.teams.home.team.abbreviation, logo: TEAM_LOGOS[game.teams.home.team.abbreviation], side: 'home' as const },
              ]

              return rows.map((row, ri) => {
                const runs = row.side === 'away' ? totalRunsA : totalRunsH
                const hits = row.side === 'away' ? totalHitsA : totalHitsH
                const err = row.side === 'away' ? totalErrA : totalErrH
                const pitcher = row.side === 'away' ? game.teams.away.probablePitcher : game.teams.home.probablePitcher

                return (
                  <tr
                    key={`${game.gamePk}-${row.side}`}
                    className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors ${isLive ? 'bg-green-500/5' : ''} ${ri === 1 ? '' : ''}`}
                    onClick={() => onSelect(game)}
                  >
                    <td className="sticky left-0 bg-card z-10 px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        {row.logo && <LogoImage src={row.logo} alt="" className="h-3.5 w-3.5" />}
                      </div>
                    </td>
                    <td className="px-2 py-1 font-medium whitespace-nowrap">{row.label}</td>
                    {Array.from({ length: maxInnings }, (_, i) => {
                      const inning = innings.find(inn => inn.num === i + 1)
                      const val = row.side === 'away' ? inning?.away.runs : inning?.home.runs
                      return (
                        <td key={i} className={`px-1.5 py-1 text-center font-mono ${val != null && val > 0 && isLive ? 'text-green-400 font-semibold' : ''}`}>
                          {val != null ? val : (isFinal || isLive ? '' : '—')}
                        </td>
                      )
                    })}
                    <td className="px-1.5 py-1 text-center font-mono font-semibold">{runs > 0 || isFinal || isLive ? runs : ''}</td>
                    <td className="px-1.5 py-1 text-center font-mono text-muted-foreground">{hits != null ? hits : ''}</td>
                    <td className="px-1.5 py-1 text-center font-mono text-muted-foreground">{err != null ? err : ''}</td>
                    <td className="px-2 py-1 text-muted-foreground truncate max-w-[100px] hidden sm:table-cell">
                      {pitcher ? (
                        <span className="font-medium">{pitcher.fullName.split(' ').pop()}</span>
                      ) : ''}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground truncate max-w-[80px] hidden sm:table-cell">
                      {ri === 1 ? game.venue?.split(' ').slice(0, 2).join(' ') || '' : ''}
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
