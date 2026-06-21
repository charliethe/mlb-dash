'use client'

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MLB_TEAMS, TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { fetchTeamRoster, fetchTodayGames, fetchTransactions, fetchStandings, fetchBulkPlayerStats } from '@/lib/mlb/api'
import { getRecentNews } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, MapPin, TrendingUp, TrendingDown, StickyNote } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { RosterPlayer, NewsItem, Transaction, MLBGame, BattingStats, PitchingStats } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'

interface TeamStandingInfo {
  wins: number
  losses: number
  pct: string
  gamesBack: string
  wildCardGamesBack?: string
  streak?: { streakCode: string; streakNumber: number }
  divisionRank?: string
  leagueRank?: string
  runsScored?: number
  runsAllowed?: number
  last10?: { wins: number; losses: number; pct: string }
  homeRecord?: { wins: number; losses: number; pct: string }
  roadRecord?: { wins: number; losses: number; pct: string }
}

export default function TeamDetailPage() {
  const params = useParams()
  const teamId = Number(params.id)
  const team = MLB_TEAMS[teamId]
  const color = team ? TEAM_COLORS[team.abbreviation] : undefined

  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [games, setGames] = useState<MLBGame[]>([])
  const [standing, setStanding] = useState<TeamStandingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [r, n, t, g, standings] = await Promise.all([
        fetchTeamRoster(teamId),
        getRecentNews(50),
        fetchTransactions(),
        fetchTodayGames(),
        fetchStandings(),
      ])
      const activeIds = r.filter((p) => p.status === 'active').map((p) => p.playerId)
      if (activeIds.length > 0) {
        const stats = await fetchBulkPlayerStats(activeIds)
        for (const player of r) {
          const s = stats.get(player.playerId)
          if (s) player.seasonStats = s
        }
      }
      if (!team) return
      setRoster(r)
      setNews(n.filter((item) => item.teamId === teamId || item.teamAbbreviation === team.abbreviation))
      setTransactions(t.filter((tr) => tr.team.id === teamId))
      setGames(g.filter((game) =>
        game.teams.away.team.id === teamId || game.teams.home.team.id === teamId
      ))

      const records = (standings as unknown as { records: { teamRecords: Record<string, unknown>[] }[] })?.records || []
      for (const div of records) {
        for (const tr of div.teamRecords) {
          const t = tr as unknown as { team: { id: number }; leagueRecord: { wins: number; losses: number; pct: string }; gamesBack: string; wildCardGamesBack?: string; streak?: { streakCode: string; streakNumber: number }; divisionRank?: string; leagueRank?: string; runsScored?: number; runsAllowed?: number; last10?: { wins: number; losses: number; pct: string }; homeRecord?: { wins: number; losses: number; pct: string }; roadRecord?: { wins: number; losses: number; pct: string } }
          if (t.team.id === teamId) {
            setStanding({
              wins: t.leagueRecord.wins,
              losses: t.leagueRecord.losses,
              pct: t.leagueRecord.pct,
              gamesBack: t.gamesBack,
              wildCardGamesBack: t.wildCardGamesBack,
              streak: t.streak,
              divisionRank: t.divisionRank,
              leagueRank: t.leagueRank,
              runsScored: t.runsScored,
              runsAllowed: t.runsAllowed,
              last10: t.last10,
              homeRecord: t.homeRecord,
              roadRecord: t.roadRecord,
            })
            break
          }
        }
      }
    } catch (err) {
      console.error('Failed to load team data:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [teamId, team])

  useEffect(() => {
    startTransition(() => { loadData() })
  }, [loadData])

  const activePlayers = useMemo(() => roster.filter((p) => p.status === 'active'), [roster])
  const ilPlayers = useMemo(() => roster.filter((p) => p.status.startsWith('il')), [roster])
  const topBatters = useMemo(() => {
    return activePlayers
      .filter((p) => p.seasonStats?.type === 'batting' && p.seasonStats?.avg)
      .sort((a, b) => parseFloat((b.seasonStats as BattingStats)?.avg || '0') - parseFloat((a.seasonStats as BattingStats)?.avg || '0'))
      .slice(0, 3)
  }, [activePlayers])
  const topPitchers = useMemo(() => {
    return activePlayers
      .filter((p) => p.seasonStats?.type === 'pitching' && p.seasonStats?.era)
      .sort((a, b) => parseFloat((a.seasonStats as PitchingStats)?.era || '99') - parseFloat((b.seasonStats as PitchingStats)?.era || '99'))
      .slice(0, 3)
  }, [activePlayers])

  if (!team) {
    return (
      <ErrorBoundary name="TeamDetail">
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Team not found</p>
        <Link href="/teams"><Button variant="outline" className="mt-4">Back to Teams</Button></Link>
      </div>
      </ErrorBoundary>
    )
  }

  const streakIcon = standing?.streak?.streakCode === 'W' ? <TrendingUp className="h-5 w-5" /> : standing?.streak?.streakCode === 'L' ? <TrendingDown className="h-5 w-5" /> : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/teams" aria-label="Back to teams">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>

      {loading ? (
        <ErrorBoundary name="TeamDetail">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </div>
        </ErrorBoundary>
      ) : error ? (
        <ErrorBoundary name="TeamDetail"><ErrorState message="Failed to load team data" onRetry={loadData} /></ErrorBoundary>
      ) : (
        <ErrorBoundary name="TeamDetail">
        <div className="space-y-4">
          {/* Team header with color banner */}
          <Card className="overflow-hidden" style={color ? { borderLeft: `4px solid ${color}` } : undefined}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {TEAM_LOGOS[team.abbreviation] && (
                  <LogoImage src={TEAM_LOGOS[team.abbreviation]} alt={team.abbreviation} className="h-16 w-16" />
                )}
                <div className="flex-1">
                  <h1 className="text-xl font-bold">{team.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {team.league} {team.division} · {team.abbreviation}
                    {standing && ` · ${standing.wins}-${standing.losses}`}
                  </p>
                </div>
                {standing && (
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{standing.wins}-{standing.losses}</span>
                      {streakIcon && (
                        <span className={standing.streak!.streakCode === 'W' ? 'text-green-400' : 'text-red-400'}>
                          {streakIcon}
                        </span>
                      )}
                    </div>
                    {standing.divisionRank && (
                      <p className="text-xs text-muted-foreground">
                        {standing.divisionRank === '1' ? '1st' : standing.divisionRank === '2' ? '2nd' : standing.divisionRank === '3' ? '3rd' : `${standing.divisionRank}th`} in {team.division}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stat boxes */}
          {standing && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <StatBoxCompact label="Pct" value={standing.pct} />
              <StatBoxCompact label="GB" value={standing.gamesBack === '-' ? '—' : standing.gamesBack} sub={standing.divisionRank ? `#${standing.divisionRank} in div` : ''} />
              <StatBoxCompact label="Streak" value={standing.streak ? `${standing.streak.streakCode}${standing.streak.streakNumber}` : '-'} sub={standing.last10 ? `L10: ${standing.last10.wins}-${standing.last10.losses}` : ''} />
              <StatBoxCompact label="Run Diff" value={standing.runsScored != null && standing.runsAllowed != null ? `${standing.runsScored - standing.runsAllowed}` : '-'} sub={standing.runsScored != null ? `${standing.runsScored} RS / ${standing.runsAllowed} RA` : ''} />
              <StatBoxCompact label="Home" value={standing.homeRecord ? `${standing.homeRecord.wins}-${standing.homeRecord.losses}` : '-'} sub={standing.homeRecord?.pct || ''} />
              <StatBoxCompact label="Road" value={standing.roadRecord ? `${standing.roadRecord.wins}-${standing.roadRecord.losses}` : '-'} sub={standing.roadRecord?.pct || ''} />
            </div>
          )}

          {/* Top performers */}
          {(topBatters.length > 0 || topPitchers.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topBatters.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top Hitters</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px] py-1">Name</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">AVG</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">HR</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">RBI</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">OPS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topBatters.map((p) => {
                          const s = p.seasonStats as BattingStats
                          return (
                            <TableRow key={p.playerId} className="text-xs">
                              <TableCell className="py-1.5 font-medium">
                                <Link href={`/players/${p.playerId}`} className="hover:underline">{p.fullName}</Link>
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.avg || '-'}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.hr ?? 0}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.rbi ?? 0}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.ops || '-'}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {topPitchers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top Pitchers</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px] py-1">Name</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">W-L</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">ERA</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">WHIP</TableHead>
                          <TableHead className="text-[11px] py-1 text-right">K</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPitchers.map((p) => {
                          const s = p.seasonStats as PitchingStats
                          return (
                            <TableRow key={p.playerId} className="text-xs">
                              <TableCell className="py-1.5 font-medium">
                                <Link href={`/players/${p.playerId}`} className="hover:underline">{p.fullName}</Link>
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.wins ?? 0}-{s.losses ?? 0}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.era || '-'}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.whip || '-'}</TableCell>
                              <TableCell className="py-1.5 text-right font-mono">{s.strikeouts ?? 0}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Today's games */}
          {games.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Games</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {games.map((game) => {
                  const isHome = game.teams.home.team.id === teamId
                  const opponent = isHome ? game.teams.away.team : game.teams.home.team
                  const ourScore = isHome ? game.teams.home.score : game.teams.away.score
                  const theirScore = isHome ? game.teams.away.score : game.teams.home.score
                  const isLive = game.status.abstractGameState === 'Live'
                  const isFinal = game.status.abstractGameState === 'Final'
                  const opponentLogo = TEAM_LOGOS[opponent.abbreviation]

                  return (
                    <div key={game.gamePk} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                      <LogoImage src={opponentLogo} alt={`${opponent.abbreviation} logo`} className="h-5 w-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{isHome ? 'vs' : 'at'} {opponent.name}</span>
                          {opponent.abbreviation && (
                            <span className="text-[10px] text-muted-foreground">({opponent.abbreviation})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <MapPin className="h-2.5 w-2.5" />
                          <span>{game.venue}</span>
                          <span>·</span>
                          <span className={isFinal ? 'text-muted-foreground' : isLive ? 'text-green-400' : ''}>
                            {isFinal ? 'Final' : isLive ? game.status.detailedState || 'Live' : format(parseISO(game.gameDate), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                      {(isLive || isFinal) && ourScore !== undefined && theirScore !== undefined && (
                        <div className="text-right shrink-0">
                          <span className={`font-mono text-lg font-bold ${isLive ? 'text-green-400' : ''}`}>{ourScore}</span>
                          <span className="text-muted-foreground font-mono text-lg mx-1">-</span>
                          <span className="font-mono text-lg text-muted-foreground">{theirScore}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Roster + News + Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Roster ({activePlayers.length})
                  {ilPlayers.length > 0 && (
                    <span className="text-muted-foreground font-normal ml-2">· {ilPlayers.length} on IL</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] py-1">#</TableHead>
                      <TableHead className="text-[11px] py-1">Name</TableHead>
                      <TableHead className="text-[11px] py-1">Pos</TableHead>
                      <TableHead className="text-[11px] py-1">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((p) => (
                      <TableRow key={p.playerId} className="text-xs">
                        <TableCell className="py-1.5 text-muted-foreground">{p.jerseyNumber || '-'}</TableCell>
                        <TableCell className="py-1.5 font-medium flex items-center gap-1.5">
                          <Link href={`/players/${p.playerId}`} className="hover:underline">{p.fullName}</Link>
                          <Link href={`/notes?playerId=${p.playerId}&playerName=${encodeURIComponent(p.fullName)}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                            <StickyNote className="h-3 w-3" />
                          </Link>
                        </TableCell>
                        <TableCell className="py-1.5">{p.position}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                            p.status === 'active' ? 'text-green-400 border-green-500/30' :
                            p.status.startsWith('il') ? 'text-red-400 border-red-500/30' :
                            'text-amber-400 border-amber-500/30'
                          }`}>
                            {p.status === 'active' ? 'Active' : p.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent News</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {news.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No recent news</div>
                  ) : (
                    <div className="divide-y divide-border max-h-72 overflow-auto">
                      {news.slice(0, 10).map((item) => (
                        <div key={item.id} className="px-3 py-2">
                          <p className="text-xs font-medium line-clamp-2">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{item.source} · {item.category}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No recent transactions</div>
                  ) : (
                    <div className="divide-y divide-border max-h-48 overflow-auto">
                      {transactions.slice(0, 10).map((t) => (
                        <div key={t.id} className="px-3 py-2">
                          <p className="text-xs line-clamp-1">{t.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t.type} · {format(parseISO(t.date), 'MMM d')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        </ErrorBoundary>
      )}
      <ScrollToTop />
    </div>
  )
}

function StatBoxCompact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/70 mt-px">{sub}</p>}
    </div>
  )
}
