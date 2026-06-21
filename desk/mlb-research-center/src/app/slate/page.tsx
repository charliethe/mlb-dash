'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { MLBGame } from '@/types'
import { getTodayGames } from '@/lib/supabase/client'
import { fetchTodayGames } from '@/lib/mlb/api'
import { upsertGames } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { GameDetailDialog } from '@/components/game/game-detail-dialog'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { DatePicker, formatDateDisplay } from '@/components/ui/date-picker'
import { Download } from 'lucide-react'
import { ScrollToTop } from '@/components/ui/scroll-to-top'

export default function SlatePage() {
  useEffect(() => { document.title = 'Slate — MLB Research' }, [])
  const today = new Date().toISOString().split('T')[0]
  const [games, setGames] = useState<MLBGame[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<MLBGame | null>(null)
  const hasLive = games.some((g) => g.status.abstractGameState === 'Live')
  const [error, setError] = useState(false)
  const [slateDate, setSlateDate] = useState(today)

  useEffect(() => {
    loadGames(slateDate)
    if (slateDate !== today) return
    const interval = setInterval(() => {
      if (hasLive) {
        fetchTodayGames(slateDate).then((data) => {
          if (data.length > 0) setGames(data)
        }).catch(() => console.warn('Slate: polling fetch failed'))
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [hasLive, slateDate, today])

  async function loadGames(date: string) {
    setLoading(true)
    setError(false)
    try {
      let data = await getTodayGames(date)
      if (data.length === 0) {
        data = await fetchTodayGames(date)
        if (data.length > 0) await upsertGames(data)
        else data = await getTodayGames(date)
      }
      setGames(data)
    } catch (err) {
      console.error('Failed to load games:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const notStarted = games.filter((g) => g.status.abstractGameState === 'Preview')
  const live = games.filter((g) => g.status.abstractGameState === 'Live')
  const final = games.filter((g) => g.status.abstractGameState === 'Final')

  function exportSlateCSV() {
    const rows = [['Status', 'Away', 'Away Score', 'Home', 'Home Score', 'Venue', 'Time']]
    const exportGames = [...live, ...notStarted, ...final]
    exportGames.forEach((g) => {
      rows.push([
        g.status.abstractGameState,
        g.teams.away.team.abbreviation,
        g.teams.away.score !== undefined ? String(g.teams.away.score) : '',
        g.teams.home.team.abbreviation,
        g.teams.home.score !== undefined ? String(g.teams.home.score) : '',
        g.venue || '',
        format(parseISO(g.gameDate), 'h:mm a'),
      ])
    })
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slate-${slateDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ErrorBoundary name="Slate">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">Slate</h1>
            <DatePicker value={slateDate} onChange={setSlateDate} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{formatDateDisplay(slateDate)}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportSlateCSV} disabled={games.length === 0}>
              <Download className="h-3 w-3" />
              CSV
            </Button>
          </div>
        </div>

        {!loading && !error && games.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Scheduled', value: notStarted.length },
              { label: 'In Progress', value: live.length },
              { label: 'Final', value: final.length },
              { label: 'Total Games', value: games.length },
            ].map((stat) => (
              <div key={stat.label} className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            <CardSkeleton count={6} />
          </div>
        ) : error ? (
          <ErrorState message="Failed to load games" onRetry={() => loadGames(slateDate)} />
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">No games scheduled on this date</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {live.map((game) => (
              <GameCard key={game.gamePk} game={game} onSelect={setSelectedGame} />
            ))}
            {notStarted.map((game) => (
              <GameCard key={game.gamePk} game={game} onSelect={setSelectedGame} />
            ))}
            {final.map((game) => (
              <GameCard key={game.gamePk} game={game} onSelect={setSelectedGame} />
            ))}
          </div>
        )}

        {selectedGame && (
          <GameDetailDialog
            game={selectedGame}
            open={!!selectedGame}
            onOpenChange={(open) => { if (!open) setSelectedGame(null) }}
          />
        )}
        <ScrollToTop />
      </div>
    </ErrorBoundary>
  )
}

function GameCard({ game, onSelect }: { game: MLBGame; onSelect: (g: MLBGame) => void }) {
  const isLive = game.status.abstractGameState === 'Live'
  const isFinal = game.status.abstractGameState === 'Final'

  return (
    <Card
      className={`${isLive ? 'border-green-500/30' : ''} cursor-pointer transition-colors hover:bg-muted/20`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(game); } }}
      onClick={() => onSelect(game)}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs text-muted-foreground font-mono">
            {isFinal ? 'FINAL' : isLive ? 'LIVE' : format(parseISO(game.gameDate), 'h:mm a')}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {game.venue?.split(' ').slice(0, 2).join(' ') || 'TBD'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {TEAM_LOGOS[game.teams.away.team.abbreviation] && (
              <LogoImage src={TEAM_LOGOS[game.teams.away.team.abbreviation]} alt={`${game.teams.away.team.abbreviation} logo`} className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">{game.teams.away.team.abbreviation}</span>
            {game.teams.away.probablePitcher && (
              <Link href={`/players/${game.teams.away.probablePitcher.id}`} className="text-xs text-muted-foreground ml-1 hover:underline">{game.teams.away.probablePitcher.fullName}</Link>
            )}
          </div>
          {(isLive || isFinal) && game.teams.away.score !== undefined && (
            <span className="text-sm font-mono font-semibold">{game.teams.away.score}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {TEAM_LOGOS[game.teams.home.team.abbreviation] && (
              <LogoImage src={TEAM_LOGOS[game.teams.home.team.abbreviation]} alt={`${game.teams.home.team.abbreviation} logo`} className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">{game.teams.home.team.abbreviation}</span>
            {game.teams.home.probablePitcher && (
              <Link href={`/players/${game.teams.home.probablePitcher.id}`} className="text-xs text-muted-foreground ml-1 hover:underline">{game.teams.home.probablePitcher.fullName}</Link>
            )}
          </div>
          {(isLive || isFinal) && game.teams.home.score !== undefined && (
            <span className="text-sm font-mono font-semibold">{game.teams.home.score}</span>
          )}
        </div>
        <div className="flex gap-2 mt-2 text-[11px] text-muted-foreground">
          {game.teams.away.leagueRecord && (
            <span>{game.teams.away.team.abbreviation}: {game.teams.away.leagueRecord.wins}-{game.teams.away.leagueRecord.losses}</span>
          )}
          {game.teams.home.leagueRecord && (
            <span>{game.teams.home.team.abbreviation}: {game.teams.home.leagueRecord.wins}-{game.teams.home.leagueRecord.losses}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
