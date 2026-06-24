'use client'

import { useState, useEffect } from 'react'
import type { MLBGame } from '@/types'
import { format, parseISO } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Loader2, Swords } from 'lucide-react'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { fetchSeasonSeries } from '@/lib/mlb/api'
import Link from 'next/link'

interface LinescoreInning {
  num: number
  away: { runs: number; hits: number; errors: number }
  home: { runs: number; hits: number; errors: number }
}

interface PlayByPlay {
  about: { inning: number; halfInning: string }
  result: { description: string }
  matchup?: { batter: { fullName: string }; pitcher: { fullName: string } }
  count?: { balls: number; strikes: number; outs: number }
}
interface LinescoreData {
  innings: LinescoreInning[]
  teams: {
    away: { runs: number; hits: number; errors: number }
    home: { runs: number; hits: number; errors: number }
  }
}

export function GameDetailDialog({ game, open, onOpenChange }: { game: MLBGame; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [linescore, setLinescore] = useState<LinescoreInning[]>([])
  const [linescoreTotals, setLinescoreTotals] = useState<{ away: { runs: number; hits: number; errors: number }; home: { runs: number; hits: number; errors: number } } | null>(null)
  const [plays, setPlays] = useState<PlayByPlay[]>([])
  const [loading, setLoading] = useState(false)
  const [showAllPlays, setShowAllPlays] = useState(false)
  const [seriesGames, setSeriesGames] = useState<MLBGame[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)

  useEffect(() => {
    if (!open) { setLinescore([]); setLinescoreTotals(null); setPlays([]); setShowAllPlays(false); setSeriesGames([]); return }
    setLoading(true)
    setSeriesLoading(true)
    const gamePk = game.gamePk
    const awayId = game.teams.away.team.id
    const homeId = game.teams.home.team.id
    Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`).then(r => r.ok ? r.json() : null),
      fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay`).then(r => r.ok ? r.json() : null),
      fetchSeasonSeries(awayId, homeId),
    ]).then(([lineData, playData, series]) => {
      if (lineData?.innings) {
        setLinescore(lineData.innings.map((i: Record<string, unknown>) => ({
          num: i.num as number,
          away: i.away as LinescoreInning['away'],
          home: i.home as LinescoreInning['home'],
        })))
      }
      if (lineData?.teams) setLinescoreTotals(lineData.teams as LinescoreData['teams'])
      if (playData?.allPlays) {
        const allPlays = playData.allPlays as PlayByPlay[]
        setPlays(allPlays.slice(-8).reverse())
      }
      if (series) setSeriesGames(series)
    }).catch(() => {}).finally(() => { setLoading(false); setSeriesLoading(false) })
  }, [open, game.gamePk])

  const isLive = game.status.abstractGameState === 'Live'
  const isFinal = game.status.abstractGameState === 'Final'
  const away = game.teams.away
  const home = game.teams.home
  const awayLogo = TEAM_LOGOS[away.team.abbreviation]
  const homeLogo = TEAM_LOGOS[home.team.abbreviation]
  const awayWins = away.probablePitcher?.wins
  const awayLosses = away.probablePitcher?.losses
  const homeWins = home.probablePitcher?.wins
  const homeLosses = home.probablePitcher?.losses

  const seriesRecord = (() => {
    if (seriesGames.length === 0) return null
    let aW = 0, hW = 0
    for (const g of seriesGames) {
      if (g.status.abstractGameState !== 'Final' || g.teams.away.score === undefined) continue
      if (g.teams.away.score > (g.teams.home.score ?? 0)) aW++
      else if ((g.teams.home.score ?? 0) > g.teams.away.score) hW++
    }
    return { awayWins: aW, homeWins: hW, total: aW + hW }
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {away.team.name} @ {home.team.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center py-1">
            <span className={`text-xs font-mono font-semibold ${
              isFinal ? 'text-muted-foreground' : isLive ? 'text-green-400' : 'text-amber-400'
            }`}>
              {isFinal ? 'FINAL' : isLive ? game.status.detailedState || 'LIVE' : format(parseISO(game.gameDate), 'h:mm a')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col items-center gap-1 flex-1">
              <LogoImage src={awayLogo} alt={`${away.team.abbreviation} logo`} className="h-10 w-10" />
              <span className="text-sm font-semibold text-center">{away.team.abbreviation}</span>
              {away.leagueRecord && (
                <span className="text-[11px] text-muted-foreground">{away.leagueRecord.wins}-{away.leagueRecord.losses}</span>
              )}
              {(isLive || isFinal) && away.score !== undefined && (
                <span className="text-2xl font-mono font-bold">{away.score}</span>
              )}
            </div>
            <div className="text-center text-muted-foreground text-sm font-mono">@</div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <LogoImage src={homeLogo} alt={`${home.team.abbreviation} logo`} className="h-10 w-10" />
              <span className="text-sm font-semibold text-center">{home.team.abbreviation}</span>
              {home.leagueRecord && (
                <span className="text-[11px] text-muted-foreground">{home.leagueRecord.wins}-{home.leagueRecord.losses}</span>
              )}
              {(isLive || isFinal) && home.score !== undefined && (
                <span className="text-2xl font-mono font-bold">{home.score}</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {game.venue}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Away Pitcher</p>
              {away.probablePitcher ? (
                <>
                  <p className="text-sm font-semibold">{away.probablePitcher.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {away.probablePitcher.throws === 'L' ? 'LHP' : 'RHP'}
                    {awayWins != null && awayLosses != null && ` · ${awayWins}-${awayLosses}`}
                    {away.probablePitcher.era && ` · ${away.probablePitcher.era} ERA`}
                  </p>
                </>
              ) : <p className="text-xs text-muted-foreground">TBD</p>}
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Home Pitcher</p>
              {home.probablePitcher ? (
                <>
                  <p className="text-sm font-semibold">{home.probablePitcher.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {home.probablePitcher.throws === 'L' ? 'LHP' : 'RHP'}
                    {homeWins != null && homeLosses != null && ` · ${homeWins}-${homeLosses}`}
                    {home.probablePitcher.era && ` · ${home.probablePitcher.era} ERA`}
                  </p>
                </>
              ) : <p className="text-xs text-muted-foreground">TBD</p>}
            </div>
          </div>

          {seriesLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          ) : seriesRecord && seriesRecord.total > 0 ? (
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Swords className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">Season Series</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono">{away.team.abbreviation}: <span className={seriesRecord.awayWins > seriesRecord.homeWins ? 'text-green-400 font-semibold' : ''}>{seriesRecord.awayWins}</span></span>
                <span className="text-muted-foreground">–</span>
                <span className="font-mono">{home.team.abbreviation}: <span className={seriesRecord.homeWins > seriesRecord.awayWins ? 'text-green-400 font-semibold' : ''}>{seriesRecord.homeWins}</span></span>
                <span className="text-muted-foreground">· {seriesRecord.total} games</span>
                {seriesGames.filter(g => g.status.abstractGameState === 'Live').length > 0 && (
                  <span className="text-[10px] text-green-400 font-medium ml-auto">LIVE</span>
                )}
              </div>
              <div className="flex gap-1 mt-1.5">
                {seriesGames.filter(g => g.status.abstractGameState === 'Final').slice(-7).map((g) => {
                  const awayWon = g.teams.away.score != null && g.teams.home.score != null && g.teams.away.score > g.teams.home.score
                  const isAway = g.teams.away.team.id === away.team.id
                  const won = isAway ? awayWon : !awayWon
                  return (
                    <span
                      key={g.gamePk}
                      className={`w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-mono ${won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      title={format(parseISO(g.gameDate), 'MMM d')}
                    >
                      {won ? 'W' : 'L'}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : null}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {linescore.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Line Score</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-1 px-1.5 text-left text-muted-foreground font-medium w-8"></th>
                      {linescore.map((i) => (
                        <th key={i.num} className="py-1 px-1.5 text-center font-mono text-muted-foreground font-medium">{i.num}</th>
                      ))}
                      <th className="py-1 px-1.5 text-center font-mono text-muted-foreground font-medium">R</th>
                      <th className="py-1 px-1.5 text-center font-mono text-muted-foreground font-medium">H</th>
                      <th className="py-1 px-1.5 text-center font-mono text-muted-foreground font-medium">E</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-1 px-1.5 font-medium">{away.team.abbreviation}</td>
                      {linescore.map((i) => (
                        <td key={i.num} className="py-1 px-1.5 text-center font-mono">{i.away.runs ?? '-'}</td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-mono font-semibold">{linescoreTotals?.away.runs ?? away.score ?? '-'}</td>
                      <td className="py-1 px-1.5 text-center font-mono">{linescoreTotals?.away.hits ?? '-'}</td>
                      <td className="py-1 px-1.5 text-center font-mono">{linescoreTotals?.away.errors ?? '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1.5 font-medium">{home.team.abbreviation}</td>
                      {linescore.map((i) => (
                        <td key={i.num} className="py-1 px-1.5 text-center font-mono">{i.home.runs ?? '-'}</td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-mono font-semibold">{linescoreTotals?.home.runs ?? home.score ?? '-'}</td>
                      <td className="py-1 px-1.5 text-center font-mono">{linescoreTotals?.home.hits ?? '-'}</td>
                      <td className="py-1 px-1.5 text-center font-mono">{linescoreTotals?.home.errors ?? '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {plays.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Recent Plays</p>
                <button onClick={() => setShowAllPlays(!showAllPlays)} className="text-[10px] text-blue-400 hover:underline cursor-pointer">
                  {showAllPlays ? 'Less' : 'All'}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(showAllPlays ? plays : plays.slice(0, 5)).map((p, i) => (
                  <div key={i} className="text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground font-mono mr-1.5">
                      {p.about.halfInning === 'top' ? '▲' : '▼'}{p.about.inning}
                    </span>
                    {p.result.description}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
