'use client'

import { useState, useEffect } from 'react'
import { fetchTeamSchedule } from '@/lib/mlb/api'
import { MLB_TEAMS, TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { format, parseISO } from 'date-fns'
import type { MLBGame } from '@/types'
import { CalendarDays } from 'lucide-react'

const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']

export default function SchedulePage() {
  useEffect(() => { document.title = 'Schedule — MLB Research' }, [])
  return (
    <ErrorBoundary name="Schedule">
      <ScheduleViewer />
    </ErrorBoundary>
  )
}

function ScheduleViewer() {
  const [teamId, setTeamId] = useState<number>(147)
  const [games, setGames] = useState<MLBGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeMonth, setActiveMonth] = useState('')

  useEffect(() => {
    loadSchedule()
  }, [teamId])

  async function loadSchedule() {
    setLoading(true)
    setError(false)
    try {
      const year = new Date().getFullYear()
      const data = await fetchTeamSchedule(teamId, `${year}-03-01`, `${year}-11-01`)
      setGames(data)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const grouped = games.reduce<Record<string, MLBGame[]>>((acc, g) => {
    const month = format(parseISO(g.gameDate), 'MMM')
    if (!acc[month]) acc[month] = []
    acc[month].push(g)
    return acc
  }, {})

  const months = Object.keys(grouped).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b))

  useEffect(() => {
    if (!activeMonth && months.length > 0) {
      const now = format(new Date(), 'MMM')
      const found = months.find((m) => m === now) || months[0]
      setActiveMonth(found)
    }
  }, [months])

  function getTeamAbbr(game: MLBGame, teamId: number): string {
    return game.teams.away.team.id === teamId ? game.teams.home.team.abbreviation : game.teams.away.team.abbreviation
  }

  function getTeamScore(game: MLBGame, teamId: number): number | undefined {
    return game.teams.away.team.id === teamId ? game.teams.away.score : game.teams.home.score
  }

  function getOpponentScore(game: MLBGame, teamId: number): number | undefined {
    return game.teams.away.team.id === teamId ? game.teams.home.score : game.teams.away.score
  }

  function isHome(game: MLBGame): boolean {
    return game.teams.home.team.id === teamId
  }

  function getResult(game: MLBGame): 'win' | 'loss' | 'tie' | undefined {
    if (game.status.abstractGameState !== 'Final') return undefined
    const teamScore = getTeamScore(game, teamId) ?? 0
    const oppScore = getOpponentScore(game, teamId) ?? 0
    if (teamScore > oppScore) return 'win'
    if (teamScore < oppScore) return 'loss'
    return 'tie'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Schedule
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={teamId}
              onChange={(e) => setTeamId(Number(e.target.value))}
              className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring min-w-[200px]"
            >
              {Object.entries(MLB_TEAMS).map(([id, info]) => (
                <option key={id} value={id}>{info.name} ({info.abbreviation})</option>
              ))}
            </select>

            <div className="flex gap-1.5 flex-wrap">
              {months.map((m) => (
                <Button
                  key={m}
                  variant={activeMonth === m ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-xs ${activeMonth === m ? '' : 'text-muted-foreground'}`}
                  onClick={() => setActiveMonth(m)}
                >
                  {m}
                </Button>
              ))}
            </div>

            <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={loadSchedule}>Refresh</Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <CardSkeleton count={10} />
      ) : error ? (
        <ErrorState message="Failed to load schedule" onRetry={loadSchedule} />
      ) : games.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground text-center">No games found for this team.</CardContent>
        </Card>
      ) : (
        <>
          {months.filter((m) => !activeMonth || m === activeMonth).map((month) => (
            <Card key={month}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{month}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {grouped[month].map((game) => {
                    const oppAbbr = getTeamAbbr(game, teamId)
                    const result = getResult(game)
                    const teamScore = getTeamScore(game, teamId)
                    const oppScore = getOpponentScore(game, teamId)
                    const isFinal = game.status.abstractGameState === 'Final'
                    const isLive = game.status.abstractGameState === 'Live'
                    const isPreview = game.status.abstractGameState === 'Preview'
                    const home = isHome(game)

                    return (
                      <div
                        key={game.gamePk}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-12 shrink-0 text-[11px] text-muted-foreground text-right tabular-nums">
                          {format(parseISO(game.gameDate), 'MMM d')}
                        </div>

                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          {result === 'win' && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500/30 text-green-400 bg-green-500/10 shrink-0">W</Badge>
                          )}
                          {result === 'loss' && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-500/30 text-red-400 bg-red-500/10 shrink-0">L</Badge>
                          )}
                          {isLive && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0 animate-pulse">LIVE</Badge>
                          )}

                          <div className="text-xs text-muted-foreground shrink-0">{home ? 'vs' : '@'}</div>

                          {TEAM_LOGOS[oppAbbr] && (
                            <LogoImage src={TEAM_LOGOS[oppAbbr]} alt={oppAbbr} className="h-4 w-4 shrink-0" />
                          )}

                          <span className="text-sm font-medium truncate">
                            {game.teams.away.team.id === teamId
                              ? game.teams.away.team.abbreviation
                              : game.teams.home.team.abbreviation}
                          </span>

                          <span className="text-[11px] text-muted-foreground">
                            {game.teams.away.team.abbreviation} @ {game.teams.home.team.abbreviation}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {isFinal && teamScore != null && oppScore != null && (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-semibold tabular-nums ${result === 'win' ? 'text-green-400' : result === 'loss' ? 'text-red-400' : ''}`}>
                                {teamScore}
                              </span>
                              <span className="text-xs text-muted-foreground">-</span>
                              <span className={`text-sm font-semibold tabular-nums ${result === 'loss' ? 'text-green-400' : result === 'win' ? 'text-red-400' : ''}`}>
                                {oppScore}
                              </span>
                            </div>
                          )}

                          {isPreview && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {format(parseISO(game.gameDate), 'h:mm a')}
                            </span>
                          )}

                          {isLive && teamScore != null && oppScore != null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold tabular-nums">{teamScore}</span>
                              <span className="text-xs text-muted-foreground">-</span>
                              <span className="text-sm font-bold tabular-nums">{oppScore}</span>
                            </div>
                          )}

                          {game.venue && (
                            <span className="text-[11px] text-muted-foreground hidden md:inline max-w-[120px] truncate">
                              {game.venue}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
      <ScrollToTop />
    </div>
  )
}
