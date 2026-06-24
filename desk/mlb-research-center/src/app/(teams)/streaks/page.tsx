'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchStandings } from '@/lib/mlb/api'
import { TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Flame, Snowflake, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

interface TeamStreak {
  team: { id: number; name: string; abbreviation: string }
  streakCode: string
  streakNumber: number
  wins: number
  losses: number
  pct: string
  last10W: number
  last10L: number
  division: string
  league: string
}

function useStreaks() {
  const [teams, setTeams] = useState<TeamStreak[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(false)

    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const standings = await fetchStandings(undefined, controller.signal)
      if (controller.signal.aborted) return
      const all: TeamStreak[] = []
      for (const div of standings.records) {
        const league = div.division.name.startsWith('AL') ? 'AL' : 'NL'
        for (const raw of div.teamRecords) {
          const rec = raw as { team: { id: number; name: string; abbreviation: string }; leagueRecord: { wins: number; losses: number; pct: string }; streak?: { streakCode: string; streakNumber: number }; last10?: { wins: number; losses: number; pct: string } }
          if (rec.leagueRecord.wins === undefined) continue
          all.push({
            team: rec.team,
            streakCode: rec.streak?.streakCode ?? '',
            streakNumber: rec.streak?.streakNumber ?? 0,
            wins: rec.leagueRecord.wins,
            losses: rec.leagueRecord.losses,
            pct: rec.leagueRecord.pct,
            last10W: rec.last10?.wins ?? 0,
            last10L: rec.last10?.losses ?? 0,
            division: div.division.name,
            league,
          })
        }
      }
      all.sort((a, b) => {
        const aOrder = a.streakCode === 'W' ? a.streakNumber : a.streakCode === 'L' ? -a.streakNumber : 0
        const bOrder = b.streakCode === 'W' ? b.streakNumber : b.streakCode === 'L' ? -b.streakNumber : 0
        return bOrder - aOrder
      })
      setTeams(all)
      setLastUpdated(new Date())
    } catch {
      if (controller.signal.aborted) return
      setError(true)
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return { teams, loading, error, lastUpdated, reload: load }
}

function StreakBadge({ code, number }: { code: string; number: number }) {
  if (!code || number === 0) return <span className="text-muted-foreground text-xs">—</span>
  const isWin = code === 'W'
  return (
    <Badge
      variant="outline"
      className={`text-xs font-mono tabular-nums ${
        isWin
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          : 'border-red-500/40 bg-red-500/10 text-red-400'
      }`}
    >
      <span className="mr-0.5">{isWin ? 'W' : 'L'}</span>
      {number}
    </Badge>
  )
}

function Last10Bar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const items = []
  for (let i = 0; i < wins; i++) items.push('green')
  for (let i = 0; i < losses; i++) items.push('red')
  while (items.length < 10) items.push('empty')

  return (
    <div className="flex gap-px">
      {items.map((color, i) => (
        <div
          key={i}
          className={`w-2 h-3 rounded-[1px] ${
            color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}

function StreakSection({ title, teams, icon: Icon, color }: {
  title: string
  teams: TeamStreak[]
  icon: React.ElementType
  color: string
}) {
  if (teams.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {teams.map((t) => (
          <Link key={t.team.id} href={`/teams/${t.team.id}`}>
            <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                {TEAM_LOGOS[t.team.abbreviation] && (
                  <LogoImage src={TEAM_LOGOS[t.team.abbreviation]} alt="" className="h-6 w-6" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.team.abbreviation}</div>
                  <div className="text-[11px] text-muted-foreground">{t.wins}-{t.losses}</div>
                </div>
                <StreakBadge code={t.streakCode} number={t.streakNumber} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function StreaksPage() {
  useEffect(() => { document.title = 'Streaks — MLB Research' }, [])
  return (
    <ErrorBoundary name="Streaks">
      <StreaksContent />
    </ErrorBoundary>
  )
}

function StreaksContent() {
  const { teams, loading, error, lastUpdated, reload } = useStreaks()
  const [league, setLeague] = useState('')

  const filtered = league ? teams.filter((t) => t.league === league) : teams

  const hotTeams = filtered.filter((t) => t.streakCode === 'W' && t.streakNumber >= 2).slice(0, 10)
  const coldTeams = filtered.filter((t) => t.streakCode === 'L' && t.streakNumber >= 2).slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          Streaks
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={reload} />
      </div>

      {loading ? (
        <CardSkeleton count={6} />
      ) : error ? (
        <ErrorState message="Failed to load streaks" onRetry={reload} />
      ) : (
        <>
          {hotTeams.length > 0 && (
            <StreakSection title="Hot" teams={hotTeams} icon={TrendingUp} color="text-emerald-400" />
          )}
          {coldTeams.length > 0 && (
            <StreakSection title="Cold" teams={coldTeams} icon={TrendingDown} color="text-red-400" />
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">All Teams</CardTitle>
                <div className="flex gap-1">
                  {['', 'AL', 'NL'].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLeague(l)}
                      className={`text-xs px-2 py-1 rounded ${
                        league === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {l || 'All'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Team</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">Streak</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">Last 10</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">Record</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">PCT</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">GB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const gb = teams.find((x) => x.team.id === t.team.id)
                      return (
                        <tr key={t.team.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3">
                            <Link href={`/teams/${t.team.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                              <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                              {TEAM_LOGOS[t.team.abbreviation] && (
                                <LogoImage src={TEAM_LOGOS[t.team.abbreviation]} alt="" className="h-4 w-4" />
                              )}
                              <span className="font-medium text-sm truncate max-w-[120px]">{t.team.name}</span>
                              <span className="text-[10px] text-muted-foreground">{t.division}</span>
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <StreakBadge code={t.streakCode} number={t.streakNumber} />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[11px] text-muted-foreground tabular-nums">{t.last10W}-{t.last10L}</span>
                              <Last10Bar wins={t.last10W} losses={t.last10L} />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center tabular-nums text-xs">{t.wins}-{t.losses}</td>
                          <td className="py-2 px-3 text-center tabular-nums text-xs text-muted-foreground">{t.pct}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-xs">
                            <span className="text-muted-foreground">—</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ScrollToTop />
    </div>
  )
}
