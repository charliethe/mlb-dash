'use client'

import { useState, useEffect } from 'react'
import { fetchTodayGames } from '@/lib/mlb/api'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Badge } from '@/components/ui/badge'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { Crosshair } from 'lucide-react'
import type { MLBGame } from '@/types'

export default function PitchersPage() {
  useEffect(() => { document.title = 'Starting Pitchers — MLB Research' }, [])
  return (
    <ErrorBoundary name="StartingPitchers">
      <PitchersInner />
    </ErrorBoundary>
  )
}

function PitchersInner() {
  const [games, setGames] = useState<MLBGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadPitchers()
  }, [])

  async function loadPitchers() {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchTodayGames()
      setGames(data)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const matchups = games
    .filter((g) => g.teams.away.probablePitcher || g.teams.home.probablePitcher)
    .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())

  const liveMatchups = matchups.filter((g) => g.status.abstractGameState === 'Live')
  const upcomingMatchups = matchups.filter((g) => g.status.abstractGameState === 'Preview')
  const finalMatchups = matchups.filter((g) => g.status.abstractGameState === 'Final')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-muted-foreground" />
          Starting Pitchers
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} />
      </div>

      {loading ? (
        <CardSkeleton count={8} />
      ) : error ? (
        <ErrorState message="Failed to load pitcher data" onRetry={loadPitchers} />
      ) : matchups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            No probable pitchers announced for today&apos;s games.
          </CardContent>
        </Card>
      ) : (
        <>
          {liveMatchups.length > 0 && (
            <Section title="Live" games={liveMatchups} />
          )}
          {upcomingMatchups.length > 0 && (
            <Section title="Upcoming" games={upcomingMatchups} />
          )}
          {finalMatchups.length > 0 && (
            <Section title="Final" games={finalMatchups} />
          )}
        </>
      )}
      <ScrollToTop />
    </div>
  )
}

function Section({ title, games }: { title: string; games: MLBGame[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title} ({games.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {games.map((game) => {
            const awayP = game.teams.away.probablePitcher
            const homeP = game.teams.home.probablePitcher
            return (
              <div key={game.gamePk} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{format(parseISO(game.gameDate), 'h:mm a')}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{game.venue?.split(' ').slice(0, 2).join(' ') || 'TBD'}</Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <PitcherCard
                    pitcher={awayP}
                    teamAbbr={game.teams.away.team.abbreviation}
                    side="away"
                    record={game.teams.away.leagueRecord}
                  />
                  <div className="flex items-center justify-center text-[11px] text-muted-foreground font-medium shrink-0 px-1 border-t sm:border-t-0 sm:border-l border-border/30 py-1 sm:py-0">
                    @
                  </div>
                  <PitcherCard
                    pitcher={homeP}
                    teamAbbr={game.teams.home.team.abbreviation}
                    side="home"
                    record={game.teams.home.leagueRecord}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function PitcherCard({
  pitcher,
  teamAbbr,
  side,
  record,
}: {
  pitcher: MLBGame['teams']['away']['probablePitcher']
  teamAbbr: string
  side: string
  record?: { wins: number; losses: number; pct: string }
}) {
  if (!pitcher) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
        {TEAM_LOGOS[teamAbbr] && <LogoImage src={TEAM_LOGOS[teamAbbr]} alt={teamAbbr} className="h-6 w-6" />}
        <div className="text-xs text-muted-foreground">TBD</div>
      </div>
    )
  }

  return (
    <Link
      href={`/players/${pitcher.id}`}
      className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group"
    >
      <div className="relative w-8 h-8 shrink-0">
        <img
          src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_60,q_auto:best/v1/people/${pitcher.id}/headshot/silo/current`}
          alt={pitcher.fullName}
          className="w-8 h-8 rounded-full object-cover bg-muted"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate group-hover:text-primary transition-colors">
          {pitcher.fullName}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {TEAM_LOGOS[teamAbbr] && <LogoImage src={TEAM_LOGOS[teamAbbr]} alt={teamAbbr} className="h-3 w-3" />}
          <span className="text-[11px] text-muted-foreground">{teamAbbr}</span>
          {record && (
            <span className="text-[11px] text-muted-foreground">· {record.wins}-{record.losses}</span>
          )}
        </div>
        <div className="flex gap-2 mt-1 text-[11px]">
          {pitcher.wins != null && pitcher.losses != null && (
            <span className="font-medium tabular-nums">{pitcher.wins}-{pitcher.losses}</span>
          )}
          {pitcher.era && (
            <span className="text-muted-foreground">ERA: {pitcher.era}</span>
          )}
          {pitcher.throws && (
            <span className="text-muted-foreground">Throws: {pitcher.throws}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
