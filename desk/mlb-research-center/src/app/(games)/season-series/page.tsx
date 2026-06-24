'use client'

import { useState, useEffect } from 'react'
import { fetchSeasonSeries, getCurrentSeason } from '@/lib/mlb/api'
import { MLB_TEAMS, TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Badge } from '@/components/ui/badge'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { format, parseISO } from 'date-fns'
import type { MLBGame } from '@/types'
import { Swords } from 'lucide-react'
import { CsvExportButton } from '@/components/ui/csv-export-button'

const CURRENT_YEAR = parseInt(getCurrentSeason())
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

export default function SeasonSeriesPage() {
  useEffect(() => { document.title = 'Season Series — MLB Research' }, [])
  return (
    <ErrorBoundary name="SeasonSeries">
      <SeasonSeriesInner />
    </ErrorBoundary>
  )
}

function SeasonSeriesInner() {
  const [teamA, setTeamA] = useState<number>(147)
  const [teamB, setTeamB] = useState<number>(110)
  const [season, setSeason] = useState(CURRENT_YEAR)
  const [games, setGames] = useState<MLBGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (teamA && teamB && teamA !== teamB) loadSeries()
    else setGames([])
  }, [teamA, teamB, season])

  async function loadSeries() {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchSeasonSeries(teamA, teamB, String(season))
      setGames(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const infoA = Object.entries(MLB_TEAMS).find(([id]) => Number(id) === teamA)?.[1]
  const infoB = Object.entries(MLB_TEAMS).find(([id]) => Number(id) === teamB)?.[1]

  const completed = games.filter((g) => g.status.abstractGameState === 'Final')
  const upcoming = games.filter((g) => g.status.abstractGameState === 'Preview')
  const live = games.filter((g) => g.status.abstractGameState === 'Live')

  const winsA = completed.filter((g) => {
    const aScore = g.teams.away.team.id === teamA ? g.teams.away.score : g.teams.home.score
    const bScore = g.teams.away.team.id === teamB ? g.teams.away.score : g.teams.home.score
    return aScore != null && bScore != null && aScore > bScore
  }).length

  const winsB = completed.filter((g) => {
    const aScore = g.teams.away.team.id === teamA ? g.teams.away.score : g.teams.home.score
    const bScore = g.teams.away.team.id === teamB ? g.teams.away.score : g.teams.home.score
    return aScore != null && bScore != null && bScore > aScore
  }).length

  const seriesLeader = winsA > winsB ? 'A' : winsB > winsA ? 'B' : null
  const recentStreak = games.filter((g) => g.status.abstractGameState === 'Final').sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()).slice(0, 7)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Swords className="h-4 w-4 text-muted-foreground" />
          Season Series
        </h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Team A</label>
              <select
                value={teamA}
                onChange={(e) => setTeamA(Number(e.target.value))}
                className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
              >
                {Object.entries(MLB_TEAMS).map(([id, info]) => (
                  <option key={id} value={id}>{info.abbreviation} — {info.name}</option>
                ))}
              </select>
            </div>

            <div className="text-sm text-muted-foreground pb-1">vs</div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Team B</label>
              <select
                value={teamB}
                onChange={(e) => setTeamB(Number(e.target.value))}
                className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
              >
                {Object.entries(MLB_TEAMS).map(([id, info]) => (
                  <option key={id} value={id}>{info.abbreviation} — {info.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Season</label>
              <select
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
                className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading && <CardSkeleton count={6} />}

      {!loading && error && <ErrorState message="Failed to load series" onRetry={loadSeries} />}

      {!loading && !error && games.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {infoA && TEAM_LOGOS[infoA.abbreviation] && (
                    <LogoImage src={TEAM_LOGOS[infoA.abbreviation]} alt={infoA.abbreviation} className="h-5 w-5" />
                  )}
                  <span>{infoA?.abbreviation}</span>
                </div>
                <span className="text-lg font-bold tabular-nums">{winsA}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-lg font-bold tabular-nums">{winsB}</span>
                <div className="flex items-center gap-2">
                  {infoB && TEAM_LOGOS[infoB.abbreviation] && (
                    <LogoImage src={TEAM_LOGOS[infoB.abbreviation]} alt={infoB.abbreviation} className="h-5 w-5" />
                  )}
                  <span>{infoB?.abbreviation}</span>
                </div>
                {seriesLeader && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-400 bg-green-500/10">
                    {seriesLeader === 'A' ? infoA?.abbreviation : infoB?.abbreviation} leads series
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {completed.length} played, {live.length} live, {upcoming.length} remaining
                </span>
                <CsvExportButton
                  filename={`season_series_${infoA?.abbreviation}_vs_${infoB?.abbreviation}_${season}`}
                  headers={['Date', 'Status', 'Away', 'Away Score', 'Home', 'Home Score', 'Venue']}
                  rows={games.map((g) => {
                    const aScore = g.teams.away.team.id === teamA ? g.teams.away.score : g.teams.home.score
                    const bScore = g.teams.away.team.id === teamB ? g.teams.away.score : g.teams.home.score
                    return [
                      g.gameDate.split('T')[0],
                      g.status.abstractGameState,
                      g.teams.away.team.abbreviation,
                      aScore ?? '',
                      g.teams.home.team.abbreviation,
                      bScore ?? '',
                      g.venue || '',
                    ]
                  })}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {games.map((game) => {
                  const aScore = game.teams.away.team.id === teamA ? game.teams.away.score : game.teams.home.score
                  const bScore = game.teams.away.team.id === teamB ? game.teams.away.score : game.teams.home.score
                  const isFinal = game.status.abstractGameState === 'Final'
                  const isLive = game.status.abstractGameState === 'Live'
                  const aWon = isFinal && aScore != null && bScore != null && aScore > bScore
                  const bWon = isFinal && aScore != null && bScore != null && bScore > aScore
                  const diff = isFinal && aScore != null && bScore != null ? Math.abs(aScore - bScore) : 0

                  return (
                    <div key={game.gamePk} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="w-16 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {format(parseISO(game.gameDate), 'MMM d')}
                      </div>

                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-2 w-[140px] justify-end">
                          <span className={`text-xs font-medium truncate ${aWon ? 'text-green-400' : ''}`}>
                            {game.teams.away.team.id === teamA ? infoA?.abbreviation : infoB?.abbreviation}
                          </span>
                          {game.teams.away.team.id === teamA && infoA && TEAM_LOGOS[infoA.abbreviation] && (
                            <LogoImage src={TEAM_LOGOS[infoA.abbreviation]} alt={infoA.abbreviation} className="h-4 w-4" />
                          )}
                          {game.teams.away.team.id !== teamA && infoB && TEAM_LOGOS[infoB.abbreviation] && (
                            <LogoImage src={TEAM_LOGOS[infoB.abbreviation]} alt={infoB.abbreviation} className="h-4 w-4" />
                          )}
                        </div>

                        <div className="text-center">
                          {isFinal && aScore != null && bScore != null ? (
                            <div className="flex items-center gap-1">
                              <span className={`text-sm font-semibold tabular-nums w-5 text-right ${aWon ? 'text-green-400' : ''}`}>{aScore}</span>
                              <span className="text-xs text-muted-foreground">-</span>
                              <span className={`text-sm font-semibold tabular-nums w-5 text-left ${bWon ? 'text-green-400' : ''}`}>{bScore}</span>
                            </div>
                          ) : isLive ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10 animate-pulse">
                              {aScore ?? 0}-{bScore ?? 0}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {format(parseISO(game.gameDate), 'h:mm a')}
                            </span>
                          )}
                          {isFinal && diff <= 2 && (
                            <span className="text-[10px] font-medium ml-1 text-amber-400">{diff === 1 ? '1-Run' : '2-Run'}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 w-[140px]">
                          {game.teams.home.team.id === teamA && infoA && TEAM_LOGOS[infoA.abbreviation] && (
                            <LogoImage src={TEAM_LOGOS[infoA.abbreviation]} alt={infoA.abbreviation} className="h-4 w-4" />
                          )}
                          {game.teams.home.team.id !== teamA && infoB && TEAM_LOGOS[infoB.abbreviation] && (
                            <LogoImage src={TEAM_LOGOS[infoB.abbreviation]} alt={infoB.abbreviation} className="h-4 w-4" />
                          )}
                          <span className={`text-xs font-medium truncate ${bWon ? 'text-green-400' : ''}`}>
                            {game.teams.home.team.id === teamA ? infoA?.abbreviation : infoB?.abbreviation}
                          </span>
                        </div>
                      </div>

                      <div className="hidden md:block text-[11px] text-muted-foreground truncate max-w-[120px]">
                        @ {game.venue || 'TBD'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
            {recentStreak.length > 0 && (
              <div className="px-4 pb-3 pt-1 flex items-center gap-1.5 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground mr-1">Streak:</span>
                {recentStreak.map((g) => {
                  const aScore = g.teams.away.team.id === teamA ? g.teams.away.score : g.teams.home.score
                  const bScore = g.teams.away.team.id === teamB ? g.teams.away.score : g.teams.home.score
                  const aWon = aScore != null && bScore != null && aScore > bScore
                  const bWon = aScore != null && bScore != null && bScore > aScore
                  const won = (g.teams.away.team.id === teamA ? aWon : bWon) || (g.teams.home.team.id === teamA ? aWon : bWon)
                  return (
                    <span
                      key={g.gamePk}
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-[2px] text-[8px] font-bold ${
                        won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {won ? 'W' : 'L'}
                    </span>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {!loading && !error && games.length === 0 && (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            {teamA === teamB
              ? 'Select two different teams'
              : 'No games found between these teams this season.'
            }
          </CardContent>
        </Card>
      )}

      <ScrollToTop />
    </div>
  )
}
