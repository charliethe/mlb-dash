'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, addDays, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TEAM_LOGOS, MLB_TEAMS, VENUE_COORDS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { fetchTodayGames, fetchTeamRoster, getCurrentSeason } from '@/lib/mlb/api'
import type { RosterPlayer } from '@/types'
import { getRecentTransactions } from '@/lib/supabase/client'
import type { MLBGame, Transaction } from '@/types'
import { getCache, setCache } from '@/lib/cache'

interface Leader {
  playerId: number
  fullName: string
  teamId?: number
  teamAbbreviation?: string
  value: string
  stat: string
}

export function TopPerformers() {
  const [batting, setBatting] = useState<Leader[]>([])
  const [pitching, setPitching] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const cached = getCache<{ batting: Leader[]; pitching: Leader[] }>('top-performers')
      if (cached) {
        setBatting(cached.batting)
        setPitching(cached.pitching)
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns,runsBattedIn&statGroup=hitting&limit=5&season=${getCurrentSeason()}`)
        const data = await res.json() as { leagueLeaders?: { leaders: { person: { id: number; fullName: string }; team?: { id: number; name: string }; value: number }[] }[] }
        const hrLeaders: Leader[] = (data.leagueLeaders?.[0]?.leaders || []).map((l: { person: { id: number; fullName: string }; team?: { id: number; name: string }; value: number }) => ({
          playerId: l.person.id,
          fullName: l.person.fullName,
          teamAbbreviation: l.team ? Object.values(MLB_TEAMS).find(t => t.name === l.team?.name)?.abbreviation : undefined,
          value: String(l.value),
          stat: 'HR',
        }))
        const rbiLeaders: Leader[] = (data.leagueLeaders?.[1]?.leaders || []).map((l: { person: { id: number; fullName: string }; team?: { id: number; name: string }; value: number }) => ({
          playerId: l.person.id,
          fullName: l.person.fullName,
          teamAbbreviation: l.team ? Object.values(MLB_TEAMS).find(t => t.name === l.team?.name)?.abbreviation : undefined,
          value: String(l.value),
          stat: 'RBI',
        }))

        const pres = await fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=earnedRunAverage,strikeouts&statGroup=pitching&limit=5&season=${getCurrentSeason()}`)
        const pdata = await pres.json() as { leagueLeaders?: { leaders: { person: { id: number; fullName: string }; team?: { id: number; name: string }; value: number }[] }[] }
        const eraLeaders: Leader[] = (pdata.leagueLeaders?.[0]?.leaders || []).map((l: { person: { id: number; fullName: string }; team?: { id: number; name: string }; value: number }) => ({
          playerId: l.person.id,
          fullName: l.person.fullName,
          teamAbbreviation: l.team ? Object.values(MLB_TEAMS).find(t => t.name === l.team?.name)?.abbreviation : undefined,
          value: String(l.value),
          stat: 'ERA',
        }))
        const kLeaders: Leader[] = (pdata.leagueLeaders?.[1]?.leaders || []).map((l: { person: { id: number; fullName: string }; team?: { id: number; name: string }; value: number }) => ({
          playerId: l.person.id,
          fullName: l.person.fullName,
          teamAbbreviation: l.team ? Object.values(MLB_TEAMS).find(t => t.name === l.team?.name)?.abbreviation : undefined,
          value: String(l.value),
          stat: 'K',
        }))

        const result = { batting: [...hrLeaders, ...rbiLeaders], pitching: [...eraLeaders, ...kLeaders] }
        setBatting(result.batting)
        setPitching(result.pitching)
        setCache('top-performers', result, 10)
      } catch (err) {
        console.error('Failed to load leaders:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {batting.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Hitting</p>
            <div className="space-y-1">
              {batting.map((p) => (
                <Link key={`${p.playerId}-${p.stat}`} href={`/players/${p.playerId}`} className="flex items-center justify-between text-xs hover:bg-muted/20 rounded px-1.5 py-0.5 -mx-1.5">
                  <span className="truncate">{p.fullName}</span>
                  <span className="font-mono shrink-0 ml-2">{p.value} {p.stat}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {pitching.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Pitching</p>
            <div className="space-y-1">
              {pitching.map((p) => (
                <Link key={`${p.playerId}-${p.stat}`} href={`/players/${p.playerId}`} className="flex items-center justify-between text-xs hover:bg-muted/20 rounded px-1.5 py-0.5 -mx-1.5">
                  <span className="truncate">{p.fullName}</span>
                  <span className="font-mono shrink-0 ml-2">{p.value} {p.stat}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function UpcomingWeek() {
  const [games, setGames] = useState<{ date: string; games: MLBGame[] }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const cached = getCache<{ date: string; games: MLBGame[] }[]>('upcoming-week')
      if (cached) {
        setGames(cached)
        setLoading(false)
        return
      }
      try {
        const dates = Array.from({ length: 7 }, (_, i) => {
          const d = addDays(new Date(), i)
          return format(d, 'yyyy-MM-dd')
        })
        const allGames = await Promise.all(dates.map((d) => fetchTodayGames(d)))
        const results = dates.map((date, i) => ({ date, games: allGames[i] }))
        setGames(results)
        setCache('upcoming-week', results, 30)
      } catch (err) {
        console.error('Failed to load upcoming week:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Upcoming Week</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : games.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">No upcoming games found</p>
        ) : (
          <div className="divide-y divide-border">
            {games.map(({ date, games: dayGames }) => (
              <div key={date} className="px-4 py-2">
                <p className="text-[11px] font-medium text-muted-foreground mb-1">
                  {format(parseISO(date), 'EEE M/d')}
                  <span className="ml-1.5 text-[10px]">({dayGames.length} game{dayGames.length !== 1 ? 's' : ''})</span>
                </p>
                {dayGames.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No games scheduled</p>
                ) : (
                  <div className="space-y-0.5">
                    {dayGames.slice(0, 3).map((g) => {
                      const awayLogo = TEAM_LOGOS[g.teams.away.team.abbreviation]
                      const homeLogo = TEAM_LOGOS[g.teams.home.team.abbreviation]
                      return (
                        <div key={g.gamePk} className="flex items-center gap-1.5 text-[11px]">
                          <LogoImage src={awayLogo} alt={`${g.teams.away.team.abbreviation} logo`} className="h-3.5 w-3.5" />
                          <span className="truncate">{g.teams.away.team.abbreviation}</span>
                          <span className="text-muted-foreground">@</span>
                          <LogoImage src={homeLogo} alt={`${g.teams.home.team.abbreviation} logo`} className="h-3.5 w-3.5" />
                          <span className="truncate">{g.teams.home.team.abbreviation}</span>
                          <span className="text-muted-foreground ml-auto">
                            {format(parseISO(g.gameDate), 'h:mm a')}
                          </span>
                        </div>
                      )
                    })}
                    {dayGames.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{dayGames.length - 3} more</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DivisionStanding {
  division: string
  teams: { name: string; abbreviation: string; wins: number; losses: number; pct: string; gb: string }[]
}

export function StandingsMini() {
  const [divisions, setDivisions] = useState<DivisionStanding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = getCache<DivisionStanding[]>('standings-mini')
      if (cached) {
        if (!cancelled) setDivisions(cached)
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${getCurrentSeason()}&standingsTypes=regularSeason`)
        const data = await res.json()
        const records = data.records || []
        const result: DivisionStanding[] = records.map((r: { division: { name: string }; teamRecords: { team: { name: string; abbreviation: string }; leagueRecord: { wins: number; losses: number; pct: string }; gamesBack: string }[] }) => ({
          division: r.division.name,
          teams: r.teamRecords.slice(0, 3).map((t: { team: { name: string; abbreviation: string }; leagueRecord: { wins: number; losses: number; pct: string }; gamesBack: string }) => ({
            name: t.team.name,
            abbreviation: t.team.abbreviation,
            wins: t.leagueRecord.wins,
            losses: t.leagueRecord.losses,
            pct: t.leagueRecord.pct,
            gb: t.gamesBack,
          })),
        }))
        if (!cancelled) setDivisions(result)
        setCache('standings-mini', result, 15)
      } catch (err) {
        console.error('Failed to load standings:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Standings
          </CardTitle>
          <Link href="/standings">
            <Button variant="ghost" size="sm" className="text-xs h-7">Full</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {divisions.map((div) => (
            <div key={div.division} className="px-4 py-2">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">{div.division}</p>
              {div.teams.map((t, i) => (
                <div key={t.abbreviation} className="flex items-center gap-1 text-[11px] py-0.5">
                  <span className="w-4 text-center text-[10px] text-muted-foreground">{i === 0 ? '1' : i + 1}</span>
                  <span className="font-medium truncate">{t.abbreviation}</span>
                  <span className="text-muted-foreground ml-auto">{t.wins}-{t.losses}</span>
                  <span className="text-muted-foreground w-10 text-right">{t.gb === '-' ? '—' : t.gb}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface VenueWeather {
  abbreviation: string
  temp: number
  condition: string
  icon: string
  rainChance: number
}

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mostly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Foggy', icon: '🌫️' },
  51: { label: 'Light Drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy Drizzle', icon: '🌧️' },
  61: { label: 'Light Rain', icon: '🌦️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy Rain', icon: '🌧️' },
  71: { label: 'Light Snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy Snow', icon: '❄️' },
  80: { label: 'Rain Showers', icon: '🌦️' },
  81: { label: 'Rain Showers', icon: '🌧️' },
  82: { label: 'Heavy Rain', icon: '🌧️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm', icon: '⛈️' },
  99: { label: 'Thunderstorm', icon: '⛈️' },
}

interface ILPlayer {
  id: number
  fullName: string
  teamAbbreviation: string
  position: string
  status: string
}

export function InjuryReport() {
  const [players, setPlayers] = useState<ILPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = getCache<ILPlayer[]>('injury-report')
      if (cached) {
        if (!cancelled) setPlayers(cached)
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const teams = Object.entries(MLB_TEAMS)
        const results: ILPlayer[] = []
        const rosters = await Promise.all(
          teams.map(([id]) => fetchTeamRoster(Number(id)).catch(() => [] as RosterPlayer[]))
        )
        for (let i = 0; i < teams.length; i++) {
          const [, info] = teams[i]
          const roster = rosters[i]
          for (const p of roster) {
            if (p.status && p.status.startsWith('il')) {
              results.push({
                id: p.playerId,
                fullName: p.fullName,
                teamAbbreviation: info.abbreviation,
                position: p.position,
                status: p.status,
              })
            }
          }
          if (cancelled) return
        }
        results.sort((a, b) => a.teamAbbreviation.localeCompare(b.teamAbbreviation))
        if (!cancelled) setPlayers(results)
        setCache('injury-report', results, 15)
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Injury Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (players.length === 0) return null

  const grouped: Record<string, ILPlayer[]> = {}
  for (const p of players) {
    if (!grouped[p.teamAbbreviation]) grouped[p.teamAbbreviation] = []
    grouped[p.teamAbbreviation].push(p)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Injury Report</CardTitle>
          <span className="text-[10px] text-muted-foreground">{players.length} players</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 max-h-80 overflow-y-auto">
        {Object.entries(grouped).map(([abbr, ps]) => (
          <div key={abbr} className="px-4 py-1.5 border-b border-border/50 last:border-0">
            <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1.5">
              {TEAM_LOGOS[abbr] && (
                <LogoImage src={TEAM_LOGOS[abbr]} alt={`${abbr} logo`} className="h-3.5 w-3.5" />
              )}
              {abbr} <span className="font-normal">({ps.length})</span>
            </p>
            {ps.map((p) => (
              <Link key={p.id} href={`/players/${p.id}`} className="flex items-center gap-2 text-xs py-0.5 hover:bg-muted/20 rounded px-1 -mx-1">
                <span className="font-medium truncate">{p.fullName}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{p.position}</span>
                <span className="text-[10px] text-red-400 ml-auto shrink-0">{p.status.toUpperCase()}</span>
              </Link>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function WeatherForecast() {
  const [weather, setWeather] = useState<VenueWeather[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = getCache<VenueWeather[]>('weather-forecast')
      if (cached) {
        if (!cancelled) setWeather(cached)
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const todayGames = await fetchTodayGames()
        const venues = new Set<string>()
        for (const g of todayGames) {
          const away = g.teams.away.team.abbreviation
          const home = g.teams.home.team.abbreviation
          if (VENUE_COORDS[away]) venues.add(away)
          if (VENUE_COORDS[home]) venues.add(home)
        }
        if (venues.size === 0) {
          if (!cancelled) setLoading(false)
          return
        }
        const coords = Array.from(venues).map((v) => VENUE_COORDS[v])
        const responses = await Promise.allSettled(
          coords.map((v) =>
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${v.lat}&longitude=${v.lon}&current=temperature_2m,weathercode&daily=precipitation_probability_max&timezone=America/New_York&temperature_unit=fahrenheit`)
          )
        )
        const results: VenueWeather[] = []
        for (let i = 0; i < responses.length; i++) {
          const r = responses[i]
          if (r.status === 'rejected') continue
          try {
            const data = await r.value.json()
            const v = coords[i]
            const abbr = Object.entries(VENUE_COORDS).find(([, c]) => c.name === v.name)?.[0] || ''
            const code = data.current?.weathercode ?? 0
            const w = WMO_CODES[code] || { label: 'Unknown', icon: '❓' }
            results.push({
              abbreviation: abbr,
              temp: Math.round(data.current?.temperature_2m ?? 0),
              condition: w.label,
              icon: w.icon,
              rainChance: data.daily?.precipitation_probability_max?.[0] ?? 0,
            })
          } catch { /* skip */ }
        }
        if (!cancelled) setWeather(results)
        setCache('weather-forecast', results, 30)
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Game Day Weather</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (weather.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Game Day Weather</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {weather.map((w) => (
            <div key={w.abbreviation} className="flex items-center gap-3 px-4 py-2">
              {TEAM_LOGOS[w.abbreviation] && (
                <LogoImage src={TEAM_LOGOS[w.abbreviation]} alt={`${w.abbreviation} logo`} className="h-5 w-5 shrink-0" />
              )}
              <span className="text-xs font-medium w-8">{w.abbreviation}</span>
              <span className="text-sm">{w.icon}</span>
              <span className="text-xs font-mono">{w.temp}°F</span>
              <span className="text-xs text-muted-foreground truncate">{w.condition}</span>
              {w.rainChance > 0 && (
                <span className="text-[10px] text-blue-400 ml-auto">{w.rainChance}% rain</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentTransactionsWidget() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const items = await getRecentTransactions(10)
        setTransactions(items)
      } catch (err) {
        console.error('Failed to load transactions:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
          <Link href="/teams">
            <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">No recent transactions</p>
        ) : (
          <div className="divide-y divide-border">
              {transactions.map((t) => (
              <div key={t.id || `${t.date}-${t.player.fullName}`} className="px-4 py-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{t.type}</Badge>
                  <span className="font-medium truncate"><Link href={`/players/${t.player.id}`} className="hover:underline">{t.player.fullName}</Link></span>
                </div>
                {t.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(parseISO(t.date), 'MMM d')} · {t.team.abbreviation}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
