'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchStandings } from '@/lib/mlb/api'
import { TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import Link from 'next/link'
import { Trophy, Medal, Star } from 'lucide-react'

const LEAGUES = [
  { id: '103', name: 'AL', label: 'American League' },
  { id: '104', name: 'NL', label: 'National League' },
]

const DIVISION_ORDER = ['ALE', 'ALC', 'ALW', 'NLE', 'NLC', 'NLW']

const DIVISION_LABELS: Record<string, string> = {
  ALE: 'AL East', ALC: 'AL Central', ALW: 'AL West',
  NLE: 'NL East', NLC: 'NL Central', NLW: 'NL West',
}

export default function PostseasonPage() {
  useEffect(() => { document.title = 'Postseason — MLB Research' }, [])
  return (
    <ErrorBoundary name="Postseason">
      <PostseasonInner />
    </ErrorBoundary>
  )
}

function PostseasonInner() {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const abortRef = useRef<AbortController | null>(null)

  async function loadData() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(false)

    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const standings = await fetchStandings(undefined, controller.signal)
      if (controller.signal.aborted) return
      const allRecords: Record<string, unknown>[] = []
      for (const div of standings.records) {
        for (const tr of div.teamRecords) {
          allRecords.push(tr)
        }
      }
      setData(allRecords)
      setLastUpdated(new Date())
    } catch {
      if (controller.signal.aborted) return
      setError(true)
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const alTeams = data.filter((r) => isAl(r))
  const nlTeams = data.filter((r) => !isAl(r))

  function getTeamAbbr(r: Record<string, unknown>): string {
    return ((r.team as Record<string, unknown>)?.abbreviation as string) || ''
  }

  function getTeamId(r: Record<string, unknown>): number {
    return Number((r.team as Record<string, unknown>)?.id) || 0
  }

  function isAl(r: Record<string, unknown>): boolean {
    const divId = (r.division as Record<string, unknown>)?.id as number || 0
    return divId >= 200 && divId <= 202
  }

  function getDivisionLeader(teams: Record<string, unknown>[], divAbbr: string): Record<string, unknown> | undefined {
    const divName = DIVISION_LABELS[divAbbr]
    const divTeams = teams.filter((r) => {
      const rDiv = r.division as Record<string, unknown> | undefined
      return rDiv?.name === divName
    })
    return divTeams.find((r) => String(r.divisionRank) === '1')
  }

  function sortByWildCard(teams: Record<string, unknown>[]): Record<string, unknown>[] {
    const divisionLeaders = teams.filter((r) => String(r.divisionRank) === '1')
    const nonLeaders = teams.filter((r) => String(r.divisionRank) !== '1')
    const leaderIds = new Set(divisionLeaders.map((r) => getTeamId(r)))
    const wildCardCandidates = nonLeaders.filter((r) => !leaderIds.has(getTeamId(r)))
    return wildCardCandidates.sort((a, b) => {
      const aGb = parseFloat((a.wildCardGamesBack as string) || '99')
      const bGb = parseFloat((b.wildCardGamesBack as string) || '99')
      return aGb - bGb
    })
  }

  function getDivAbbrs(leagueName: string): string[] {
    return DIVISION_ORDER.filter((d) => d.startsWith(leagueName))
  }

  if (loading) return <CardSkeleton count={8} />
  if (error) return <ErrorState message="Failed to load postseason data" onRetry={loadData} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Postseason Picture
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {LEAGUES.map((league) => {
          const teams = league.name === 'AL' ? alTeams : nlTeams
          const divAbbrs = getDivAbbrs(league.name)
          const wcTeams = sortByWildCard(teams).slice(0, 5)

          return (
            <div key={league.id} className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Medal className="h-4 w-4 text-amber-400" />
                    {league.label} — Division Leaders
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {divAbbrs.map((divAbbr) => {
                      const leader = getDivisionLeader(teams, divAbbr)
                      if (!leader) return null
                      const abbr = getTeamAbbr(leader)
                      const color = TEAM_COLORS[abbr] || '#666'
                      return (
                        <Link
                          key={divAbbr}
                          href={`/teams/${getTeamId(leader)}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="w-8 shrink-0">
                            {TEAM_LOGOS[abbr] && <LogoImage src={TEAM_LOGOS[abbr]} alt={abbr} className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium group-hover:text-primary transition-colors">
                              {divAbbrs.length > 0 && (
                                <span className="text-[11px] text-muted-foreground font-normal mr-2">
                                  {DIVISION_LABELS[divAbbr]}
                                </span>
                              )}
                              {(leader.team as Record<string, unknown>)?.name as string}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {(leader.leagueRecord as Record<string, unknown>)?.wins as string}-{(leader.leagueRecord as Record<string, unknown>)?.losses as string}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                GB: {leader.gamesBack as string}
                              </span>
                              {(leader as Record<string, unknown>).magicNumber != null && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-400 bg-green-500/10">
                                  M# {(leader as Record<string, unknown>).magicNumber as number}
                                </Badge>
                              )}
                              {Boolean((leader as Record<string, unknown>).clinched) && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-400 bg-green-500/10">
                                  <Trophy className="h-2.5 w-2.5 mr-0.5" /> Clinched
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-blue-400" />
                    {league.label} — Wild Card Race
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {wcTeams.map((team) => {
                      const abbr = getTeamAbbr(team)
                      const color = TEAM_COLORS[abbr] || '#666'
                      const wcRank = (team.wildCardRank as string) || '-'
                      const wcGb = (team.wildCardGamesBack as string) || '-'
                      const maxWcGb = 12
                      const wcPct = Math.min(parseFloat(wcGb) / maxWcGb, 1)
                      return (
                        <Link
                          key={getTeamId(team)}
                          href={`/teams/${getTeamId(team)}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                        >
                          <span className="text-xs text-muted-foreground w-4 text-right font-mono">{wcRank}</span>
                          <div className="w-8 shrink-0">
                            {TEAM_LOGOS[abbr] && <LogoImage src={TEAM_LOGOS[abbr]} alt={abbr} className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                              {(team.team as Record<string, unknown>)?.name as string}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {(team.leagueRecord as Record<string, unknown>)?.wins as string}-{(team.leagueRecord as Record<string, unknown>)?.losses as string}
                              </span>
                              {wcGb !== '0' && (
                                <span className="text-xs text-muted-foreground">WC GB: {wcGb}</span>
                              )}
                              {Boolean((team as Record<string, unknown>).clinched) && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-400 bg-green-500/10">
                                  Clinched
                                </Badge>
                              )}
                              {(team as Record<string, unknown>).eliminationNumber != null && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10">
                                  E# {(team as Record<string, unknown>).eliminationNumber as number}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${(1 - wcPct) * 100}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      <ScrollToTop />
    </div>
  )
}
