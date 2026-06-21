'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { MLBGame } from '@/types'
import { getTodayGames } from '@/lib/supabase/client'
import { fetchTodayGames, fetchGameLineup } from '@/lib/mlb/api'
import { upsertGames } from '@/lib/supabase/client'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Skeleton } from '@/components/ui/skeleton'

export function LineupCenter() {
  const [games, setGames] = useState<MLBGame[]>([])
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [boxscore, setBoxscore] = useState<Record<string, unknown> | null>(null)
  const [loadingLineup, setLoadingLineup] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let data = await getTodayGames()
        if (data.length === 0) {
          data = await fetchTodayGames()
          if (data.length > 0) await upsertGames(data)
        }
        if (!cancelled) setGames(data)
        if (data.length > 0) {
          if (!cancelled) setSelectedGame(String(data[0].gamePk))
        }
      } catch (err) {
        console.error('Failed to load games:', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedGame) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoadingLineup(true)
    })
    fetchGameLineup(Number(selectedGame))
      .then((data) => { if (!cancelled) setBoxscore(data) })
      .catch(() => { if (!cancelled) { setBoxscore(null); console.warn('Failed to load lineup for game', selectedGame) } })
      .finally(() => { if (!cancelled) setLoadingLineup(false) })
    return () => { cancelled = true }
  }, [selectedGame])

  const gameOptions = games.map((g) => ({
    value: String(g.gamePk),
    label: `${g.teams.away.team.abbreviation} @ ${g.teams.home.team.abbreviation}`,
  }))

  const selectedGameData = games.find((g) => String(g.gamePk) === selectedGame) || games[0]

  const awayLineup = boxscore ? extractLineup(boxscore, 'away') : null
  const homeLineup = boxscore ? extractLineup(boxscore, 'home') : null
  const awayNote = boxscore ? extractNote(boxscore, 'away') : null
  const homeNote = boxscore ? extractNote(boxscore, 'home') : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Lineup Center</CardTitle>
          <Select value={selectedGame} onValueChange={(v) => v && setSelectedGame(v)}>
            <SelectTrigger className="w-[220px] h-8 text-xs" aria-label="Select game">
              <SelectValue placeholder="Select game..." />
            </SelectTrigger>
            <SelectContent>
              {gameOptions.map((g) => (
                <SelectItem key={g.value} value={g.value} className="text-xs">{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded" />
                <div><Skeleton className="h-4 w-16 mb-1" /><Skeleton className="h-3 w-12" /></div>
              </div>
              <Skeleton className="h-16 rounded-md" />
              <div className="space-y-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex gap-2"><Skeleton className="h-4 w-6" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-8" /></div>
                ))}
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded" />
                <div><Skeleton className="h-4 w-16 mb-1" /><Skeleton className="h-3 w-12" /></div>
              </div>
              <Skeleton className="h-16 rounded-md" />
              <div className="space-y-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex gap-2"><Skeleton className="h-4 w-6" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-8" /></div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-400">Failed to load games</div>
        ) : !selectedGameData ? (
          <div className="p-4 text-sm text-muted-foreground">No games scheduled today</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <TeamLineupSide
              teamInfo={selectedGameData.teams.away}
              side="Away"
              lineup={awayLineup}
              note={awayNote}
              loading={loadingLineup}
              logo={TEAM_LOGOS[selectedGameData.teams.away.team.abbreviation]}
            />
            <TeamLineupSide
              teamInfo={selectedGameData.teams.home}
              side="Home"
              lineup={homeLineup}
              note={homeNote}
              loading={loadingLineup}
              logo={TEAM_LOGOS[selectedGameData.teams.home.team.abbreviation]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TeamLineupSide({ teamInfo, lineup, note, loading, logo }: {
  teamInfo: MLBGame['teams']['away']; side: string; lineup: LineupEntry[] | null; note: string | null; loading: boolean; logo?: string;
}) {
  const hasLineup = lineup != null && lineup.length > 0

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LogoImage src={logo} alt={`${teamInfo.team.abbreviation} logo`} className="h-6 w-6" />
          <div>
            <h3 className="text-sm font-semibold">{teamInfo.team.abbreviation}</h3>
            {teamInfo.leagueRecord && (
              <p className="text-[11px] text-muted-foreground">
                {teamInfo.leagueRecord.wins}-{teamInfo.leagueRecord.losses}
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={hasLineup ? 'text-green-400 border-green-500/30' : 'text-amber-400 border-amber-500/30'}>
          {hasLineup ? 'Lineup Posted' : 'Not Yet'}
        </Badge>
      </div>

      {teamInfo.probablePitcher && (
        <div className="mb-3 p-2 bg-muted/30 rounded-md">
          <p className="text-[11px] text-muted-foreground">Probable Pitcher</p>
          <p className="text-sm font-medium"><Link href={`/players/${teamInfo.probablePitcher.id}`} className="hover:underline">{teamInfo.probablePitcher.fullName}</Link></p>
          {teamInfo.probablePitcher.wins !== undefined && (
            <p className="text-[11px] text-muted-foreground">
              {teamInfo.probablePitcher.wins}-{teamInfo.probablePitcher.losses} · {teamInfo.probablePitcher.era || '-'} ERA
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 py-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex gap-2 px-2"><Skeleton className="h-4 w-6" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-8" /></div>
          ))}
        </div>
      ) : hasLineup ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] py-1 w-8">#</TableHead>
              <TableHead className="text-[11px] py-1">Player</TableHead>
              <TableHead className="text-[11px] py-1 w-8">Pos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineup.map((entry, i) => (
              <TableRow key={`${entry.playerId}-${i}`} className="text-xs">
                <TableCell className="py-1.5 text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="py-1.5 font-medium"><Link href={`/players/${entry.playerId}`} className="hover:underline">{entry.name}</Link></TableCell>
                <TableCell className="py-1.5">{entry.position}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-md">
          {note || 'Lineup not yet posted'}
        </div>
      )}
    </div>
  )
}

interface LineupEntry {
  playerId: number
  name: string
  position: string
}

function extractLineup(boxscore: Record<string, unknown>, side: 'away' | 'home'): LineupEntry[] | null {
  try {
    const teams = boxscore.teams as Record<string, unknown> | undefined
    if (!teams) return null
    const team = teams[side] as Record<string, unknown> | undefined
    if (!team) return null
    const batters = team.batters as { personId: number; fullName: string }[] | undefined
    if (!batters || batters.length === 0) return null
    const battingOrder = team.battingOrder as number[] | undefined
    if (!battingOrder) return null

    const playerMap = new Map<number, { fullName: string; position: string }>()
    const players = team.players as Record<string, { person: { id: number; fullName: string }; position: { abbreviation: string } }> | undefined
    if (players) {
      for (const key of Object.keys(players)) {
        const p = players[key]
        if (p?.person?.id) {
          playerMap.set(p.person.id, {
            fullName: p.person.fullName,
            position: p.position?.abbreviation || '',
          })
        }
      }
    }

    return battingOrder
      .filter((id) => id > 0)
      .map((id) => {
        const player = playerMap.get(id)
        if (!player) return null
        return { playerId: id, name: player.fullName, position: player.position }
      })
      .filter((e): e is LineupEntry => e != null)
  } catch {
    return null
  }
}

function extractNote(boxscore: Record<string, unknown>, side: 'away' | 'home'): string | null {
  try {
    const teams = boxscore.teams as Record<string, unknown> | undefined
    if (!teams) return null
    const note = (teams[side] as Record<string, unknown> | undefined)?.note as string | undefined
    return note || null
  } catch {
    return null
  }
}
