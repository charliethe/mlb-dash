'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fetchPlayerInfo, fetchBulkPlayerStats, fetchTodayGames, fetchPlayerCareerStats, fetchPlayerGameLog, fetchPlayerSplits } from '@/lib/mlb/api'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MapPin, StickyNote } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { MLBPlayer, BattingStats, PitchingStats, MLBGame, NewsItem, GameLogEntry, VsSplit } from '@/types'
import { getRecentNews } from '@/lib/supabase/client'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function PlayerDetailPage() {
  const params = useParams()
  const playerId = Number(params.id)
  const [player, setPlayer] = useState<MLBPlayer | null>(null)
  const [stats, setStats] = useState<BattingStats | PitchingStats | null>(null)
  const [careerStats, setCareerStats] = useState<BattingStats | PitchingStats | null>(null)
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([])
  const [fullGameLog, setFullGameLog] = useState<GameLogEntry[]>([])
  const [showFullLog, setShowFullLog] = useState(false)
  const [splits, setSplits] = useState<{ vsLhp?: VsSplit; vsRhp?: VsSplit }>({})
  const [games, setGames] = useState<MLBGame[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    ;(async () => {
      try {
        const [info, statsMap, g, allNews, career, log, vsSplits] = await Promise.all([
          fetchPlayerInfo(playerId),
          fetchBulkPlayerStats([playerId]),
          fetchTodayGames(),
          getRecentNews(100),
          fetchPlayerCareerStats(playerId),
          fetchPlayerGameLog(playerId),
          fetchPlayerSplits(playerId),
        ])
        if (!cancelled) setPlayer(info)
        if (!cancelled) setStats(statsMap.get(playerId) || null)
        if (!cancelled) setCareerStats(career.batting ?? career.pitching ?? null)
        if (!cancelled) setGameLog(log)
        if (!cancelled) setSplits(vsSplits)
        if (info?.currentTeam) {
          if (!cancelled) setGames(
            g.filter((game) =>
              game.teams.away.team.id === info.currentTeam!.id ||
              game.teams.home.team.id === info.currentTeam!.id
            )
          )
        }
        if (info) {
          const nameParts = info.fullName.toLowerCase().split(' ')
          if (!cancelled) setNews(
            allNews.filter((item) => {
              if (!item.title) return false
              const title = item.title.toLowerCase()
              return nameParts.some((part) => part.length > 2 && title.includes(part))
            }).slice(0, 5)
          )
        }
      } catch (err) {
        console.error('Failed to load player:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [playerId])

  if (loading) return <ErrorBoundary name="PlayerDetail"><PlayerSkeleton /></ErrorBoundary>
  if (!player) {
    return (
      <ErrorBoundary name="PlayerDetail">
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Player not found</p>
        <Link href="/watchlist">
          <Button variant="outline" className="mt-4">Back to Watchlist</Button>
        </Link>
      </div>
      </ErrorBoundary>
    )
  }

  const isPitcher = player.primaryPosition === 'P'
  const logo = player.currentTeam ? TEAM_LOGOS[player.currentTeam.abbreviation] : null
  const batting = !isPitcher && stats?.type === 'batting' ? stats : null
  const pitching = isPitcher && stats?.type === 'pitching' ? stats : null

  return (
    <ErrorBoundary name="PlayerDetail">
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/watchlist" aria-label="Back to watchlist">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <LogoImage src={logo} alt={`${player.currentTeam?.abbreviation || 'Team'} logo`} className="h-10 w-10" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{player.fullName}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {player.currentTeam && <span>{player.currentTeam.name} ({player.currentTeam.abbreviation})</span>}
            <span>·</span>
            <span>{player.primaryPosition}</span>
            <span>·</span>
            <span>B/T: {player.bats}/{player.throws}</span>
          </div>
        </div>
        <Link href={`/notes?playerId=${player.id}&playerName=${encodeURIComponent(player.fullName)}`}>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <StickyNote className="h-3 w-3" />
            Note
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {stats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">2026 Season Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {batting ? <BattingStatsTable stats={batting} /> : null}
                  {pitching ? <PitchingStatsTable stats={pitching} /> : null}
                </div>
                <StatBars stats={stats} />
              </CardContent>
            </Card>
          )}

          {careerStats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Career Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {careerStats.type === 'batting' ? <BattingStatsTable stats={careerStats} /> : null}
                  {careerStats.type === 'pitching' ? <PitchingStatsTable stats={careerStats} /> : null}
                </div>
              </CardContent>
            </Card>
          )}

          {gameLog.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{showFullLog ? 'Season Game Log' : 'Last 10 Games'}</CardTitle>
                  <button onClick={async () => {
                    if (showFullLog) {
                      setShowFullLog(false)
                    } else if (fullGameLog.length > 0) {
                      setShowFullLog(true)
                    } else {
                      const log = await fetchPlayerGameLog(playerId, 200)
                      setFullGameLog(log)
                      setShowFullLog(true)
                    }
                  }} className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                    {showFullLog ? 'Show fewer' : 'View full season'}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(showFullLog ? fullGameLog : gameLog).map((entry, i) => {
                  const line = isPitcher
                    ? `${entry.inningsPitched || '-'} IP, ${entry.hits ?? '-'} H, ${entry.earnedRuns ?? '-'} ER, ${entry.walks ?? '-'} BB, ${entry.strikeouts ?? '-'} K`
                    : `${entry.ab ?? 0}-${entry.hits ?? 0}, ${entry.rbi ?? 0} RBI${entry.homeRuns ? `, ${entry.homeRuns} HR` : ''}`
                  return (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-border last:border-0 text-xs">
                      <span className="text-muted-foreground shrink-0 w-12">{format(parseISO(entry.date), 'M/d')}</span>
                      <span className="text-muted-foreground shrink-0">{entry.isHome ? 'vs' : '@'}</span>
                      <span className="font-medium truncate">{entry.opponent}</span>
                      <span className={entry.isWin ? 'text-green-400' : 'text-red-400 shrink-0'}>
                        {entry.isWin ? 'W' : 'L'}
                      </span>
                      <span className="text-muted-foreground truncate">{line}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {games.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Games</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {games.map((game) => {
                  const isHome = game.teams.home.team.id === player.currentTeam!.id
                  const opponent = isHome ? game.teams.away.team : game.teams.home.team
                  const opponentLogo = TEAM_LOGOS[opponent.abbreviation]
                  const isLive = game.status.abstractGameState === 'Live'
                  const isFinal = game.status.abstractGameState === 'Final'
                  return (
                    <div key={game.gamePk} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                      <LogoImage src={opponentLogo} alt={`${opponent.abbreviation} logo`} className="h-5 w-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{isHome ? 'vs' : 'at'} {opponent.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-2.5 w-2.5" />
                          <span>{game.venue}</span>
                          <span>·</span>
                          <span className={isFinal ? '' : isLive ? 'text-green-400' : ''}>
                            {isFinal ? 'Final' : isLive ? game.status.detailedState : format(parseISO(game.gameDate), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                      {(isLive || isFinal) && (
                        <div className="text-right shrink-0 font-mono text-sm">
                          <span>{isHome ? game.teams.home.score ?? '-' : game.teams.away.score ?? '-'}</span>
                          <span className="text-muted-foreground mx-1">-</span>
                          <span className="text-muted-foreground">{isHome ? game.teams.away.score ?? '-' : game.teams.home.score ?? '-'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position</span>
                <span className="font-medium">{player.primaryPosition}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bats</span>
                <span className="font-medium">{player.bats === 'R' ? 'Right' : player.bats === 'L' ? 'Left' : 'Switch'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Throws</span>
                <span className="font-medium">{player.throws === 'R' ? 'Right' : 'Left'}</span>
              </div>
              {player.currentTeam && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team</span>
                  <span className="font-medium">{player.currentTeam.abbreviation}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(splits.vsLhp || splits.vsRhp) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Vs. Splits</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-1.5 text-muted-foreground font-medium"></th>
                        <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">LHP</th>
                        <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">RHP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'AVG', lhp: splits.vsLhp?.avg, rhp: splits.vsRhp?.avg },
                        { label: 'OBP', lhp: splits.vsLhp?.obp, rhp: splits.vsRhp?.obp },
                        { label: 'SLG', lhp: splits.vsLhp?.slg, rhp: splits.vsRhp?.slg },
                        { label: 'OPS', lhp: splits.vsLhp?.ops, rhp: splits.vsRhp?.ops },
                        { label: 'AB', lhp: splits.vsLhp?.ab, rhp: splits.vsRhp?.ab },
                        { label: 'H', lhp: splits.vsLhp?.hits, rhp: splits.vsRhp?.hits },
                        { label: 'HR', lhp: splits.vsLhp?.homeRuns, rhp: splits.vsRhp?.homeRuns },
                        { label: 'BB', lhp: splits.vsLhp?.walks, rhp: splits.vsRhp?.walks },
                        { label: 'SO', lhp: splits.vsLhp?.strikeouts, rhp: splits.vsRhp?.strikeouts },
                      ].map((row) => (
                        <tr key={row.label} className="border-b border-border last:border-0">
                          <td className="px-3 py-1 text-muted-foreground">{row.label}</td>
                          <td className="px-3 py-1 text-right font-mono">{row.lhp ?? '-'}</td>
                          <td className="px-3 py-1 text-right font-mono">{row.rhp ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {news.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">News Mentions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {news.map((item) => (
                    <div key={item.id} className="px-4 py-2">
                      <p className="text-xs leading-snug line-clamp-2">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.source}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {item.publishedAt ? format(parseISO(item.publishedAt), 'MMM d') : ''}
                        </span>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline ml-auto">
                            Read
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ScrollToTop />
    </div>
    </ErrorBoundary>
  )
}

function BattingStatsTable({ stats }: { stats: BattingStats }) {
  const rows = [
    { label: 'Games', value: stats.games },
    { label: 'AVG', value: stats.avg || '-' },
    { label: 'OBP', value: stats.obp || '-' },
    { label: 'SLG', value: stats.slg || '-' },
    { label: 'OPS', value: stats.ops || '-' },
    { label: 'HR', value: stats.hr },
    { label: 'RBI', value: stats.rbi },
    { label: 'R', value: stats.runs },
    { label: 'H', value: stats.hits },
    { label: '2B', value: stats.doubles },
    { label: '3B', value: stats.triples },
    { label: 'SB', value: stats.stolenBases },
    { label: 'BB', value: stats.walks },
    { label: 'SO', value: stats.strikeouts },
  ]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
      {rows.map((r) => (
        <div key={r.label} className="p-2 rounded bg-muted/20 text-center">
          <p className="text-xs font-mono font-bold">{r.value ?? '-'}</p>
          <p className="text-[10px] text-muted-foreground">{r.label}</p>
        </div>
      ))}
    </div>
  )
}

function PitchingStatsTable({ stats }: { stats: PitchingStats }) {
  const rows = [
    { label: 'W', value: stats.wins },
    { label: 'L', value: stats.losses },
    { label: 'ERA', value: stats.era || '-' },
    { label: 'WHIP', value: stats.whip || '-' },
    { label: 'G', value: stats.games },
    { label: 'GS', value: stats.gamesStarted },
    { label: 'IP', value: stats.inningsPitched || '-' },
    { label: 'K', value: stats.strikeouts },
    { label: 'BB', value: stats.walks },
    { label: 'SV', value: stats.saves },
    { label: 'H', value: stats.holds },
  ]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {rows.map((r) => (
        <div key={r.label} className="p-2 rounded bg-muted/20 text-center">
          <p className="text-xs font-mono font-bold">{r.value ?? '-'}</p>
          <p className="text-[10px] text-muted-foreground">{r.label}</p>
        </div>
      ))}
    </div>
  )
}

function StatBars({ stats }: { stats: BattingStats | PitchingStats }) {
  const isBatting = stats.type === 'batting'
  const bars = isBatting
    ? [
        { label: 'AVG', value: parseFloat((stats as BattingStats).avg || '0'), max: 0.35, color: 'bg-blue-500' },
        { label: 'OBP', value: parseFloat((stats as BattingStats).obp || '0'), max: 0.40, color: 'bg-cyan-500' },
        { label: 'SLG', value: parseFloat((stats as BattingStats).slg || '0'), max: 0.60, color: 'bg-indigo-500' },
        { label: 'HR', value: (stats as BattingStats).hr ?? 0, max: 50, color: 'bg-red-500' },
        { label: 'RBI', value: (stats as BattingStats).rbi ?? 0, max: 130, color: 'bg-amber-500' },
        { label: 'SB', value: (stats as BattingStats).stolenBases ?? 0, max: 40, color: 'bg-green-500' },
      ]
    : [
        { label: 'ERA', value: parseFloat((stats as PitchingStats).era || '5'), max: 5.00, color: 'bg-green-500', invert: true },
        { label: 'WHIP', value: parseFloat((stats as PitchingStats).whip || '1.5'), max: 1.50, color: 'bg-emerald-500', invert: true },
        { label: 'K', value: (stats as PitchingStats).strikeouts ?? 0, max: 250, color: 'bg-red-500' },
        { label: 'W', value: (stats as PitchingStats).wins ?? 0, max: 20, color: 'bg-amber-500' },
        { label: 'SV', value: (stats as PitchingStats).saves ?? 0, max: 50, color: 'bg-purple-500' },
        { label: 'IP', value: parseFloat((stats as PitchingStats).inningsPitched || '0'), max: 220, color: 'bg-sky-500' },
      ]

  return (
    <div className="mt-3 space-y-1.5">
      {bars.map((b) => {
        const pct = Math.min(b.value / b.max, 1) * 100
        const displayVal = typeof b.value === 'number' ? b.value.toFixed(b.label === 'AVG' || b.label === 'OBP' || b.label === 'SLG' || b.label === 'ERA' || b.label === 'WHIP' ? 3 : 0) : b.value
        return (
          <div key={b.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-8 text-right text-muted-foreground shrink-0">{b.label}</span>
            <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${b.color}`}
                style={{ width: `${b.invert ? 100 - pct : pct}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono font-medium shrink-0">{displayVal}</span>
          </div>
        )
      })}
    </div>
  )
}

function PlayerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  )
}
