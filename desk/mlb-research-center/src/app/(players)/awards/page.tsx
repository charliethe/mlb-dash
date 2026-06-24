'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchStatLeaders, getCurrentSeason } from '@/lib/mlb/api'
import { TEAM_LOGOS, playerHeadshotUrl } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import type { StatLeaderEntry } from '@/types'

const SEASON = getCurrentSeason()

interface AwardCandidate {
  playerId: number
  playerName: string
  teamAbbreviation: string
  totalScore: number
  stats: Record<string, number>
  ranks: Record<string, number>
}

interface AwardCategory {
  id: string
  label: string
  statCategories: { id: string; label: string }[]
}

const AWARDS: Record<string, AwardCategory[]> = {
  mvp: [
    {
      id: 'mvp_al',
      label: 'AL MVP',
      statCategories: [
        { id: 'battingAverage', label: 'AVG' },
        { id: 'homeRuns', label: 'HR' },
        { id: 'runsBattedIn', label: 'RBI' },
        { id: 'onBasePlusSlugging', label: 'OPS' },
        { id: 'runs', label: 'R' },
        { id: 'stolenBases', label: 'SB' },
      ],
    },
    {
      id: 'mvp_nl',
      label: 'NL MVP',
      statCategories: [
        { id: 'battingAverage', label: 'AVG' },
        { id: 'homeRuns', label: 'HR' },
        { id: 'runsBattedIn', label: 'RBI' },
        { id: 'onBasePlusSlugging', label: 'OPS' },
        { id: 'runs', label: 'R' },
        { id: 'stolenBases', label: 'SB' },
      ],
    },
  ],
  cy: [
    {
      id: 'cy_al',
      label: 'AL Cy Young',
      statCategories: [
        { id: 'earnedRunAverage', label: 'ERA' },
        { id: 'wins', label: 'W' },
        { id: 'strikeoutsPitching', label: 'K' },
        { id: 'whip', label: 'WHIP' },
        { id: 'inningsPitched', label: 'IP' },
      ],
    },
    {
      id: 'cy_nl',
      label: 'NL Cy Young',
      statCategories: [
        { id: 'earnedRunAverage', label: 'ERA' },
        { id: 'wins', label: 'W' },
        { id: 'strikeoutsPitching', label: 'K' },
        { id: 'whip', label: 'WHIP' },
        { id: 'inningsPitched', label: 'IP' },
      ],
    },
  ],
  roy: [
    {
      id: 'roy_al',
      label: 'AL Rookie of the Year',
      statCategories: [
        { id: 'battingAverage', label: 'AVG' },
        { id: 'homeRuns', label: 'HR' },
        { id: 'runsBattedIn', label: 'RBI' },
        { id: 'onBasePlusSlugging', label: 'OPS' },
      ],
    },
    {
      id: 'roy_nl',
      label: 'NL Rookie of the Year',
      statCategories: [
        { id: 'battingAverage', label: 'AVG' },
        { id: 'homeRuns', label: 'HR' },
        { id: 'runsBattedIn', label: 'RBI' },
        { id: 'onBasePlusSlugging', label: 'OPS' },
      ],
    },
  ],
}

function formatStat(categoryId: string, value: number): string {
  if (categoryId === 'battingAverage' || categoryId === 'onBasePlusSlugging' || categoryId === 'onBasePercentage' || categoryId === 'sluggingPercentage' || categoryId === 'whip' || categoryId === 'earnedRunAverage') {
    return value.toFixed(3)
  }
  if (categoryId === 'inningsPitched') {
    return value.toFixed(1)
  }
  return String(Math.round(value))
}

async function computeAwardRace(def: AwardCategory, playerPool?: string): Promise<AwardCandidate[]> {
  const leagueId = def.id.includes('al') ? '103' : '104'
  const statGroup = def.id.startsWith('cy') || def.id.startsWith('roy_p') ? 'pitching' : 'hitting'

  const results = await Promise.all(
    def.statCategories.map((cat) => fetchStatLeaders(cat.id, 30, SEASON, statGroup, leagueId, playerPool)),
  )

  const playerMap = new Map<number, AwardCandidate>()

  def.statCategories.forEach((cat, i) => {
    const leaders = results[i]
    leaders.forEach((entry) => {
      if (!playerMap.has(entry.playerId)) {
        playerMap.set(entry.playerId, {
          playerId: entry.playerId,
          playerName: entry.playerName,
          teamAbbreviation: entry.teamAbbreviation,
          totalScore: 0,
          stats: {},
          ranks: {},
        })
      }
      const candidate = playerMap.get(entry.playerId)!
      candidate.stats[cat.id] = entry.value
      candidate.ranks[cat.id] = entry.rank
      candidate.totalScore += Math.max(0, 31 - entry.rank)
    })
  })

  return Array.from(playerMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 15)
}

export default function AwardsPage() {
  useEffect(() => { document.title = 'Awards Tracker — MLB Research' }, [])
  return (
    <ErrorBoundary name="AwardsTracker">
      <AwardsExplorer />
    </ErrorBoundary>
  )
}

function AwardsExplorer() {
  const [awardType, setAwardType] = useState<'mvp' | 'cy' | 'roy'>('mvp')
  const [activeTab, setActiveTab] = useState('mvp_al')
  const [candidates, setCandidates] = useState<AwardCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const defs = AWARDS[awardType]
  const currentDef = defs.find((d) => d.id === activeTab) || defs[0]

  useEffect(() => {
    setActiveTab(defs[0].id)
  }, [awardType])

  const loadRace = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const pool = awardType === 'roy' ? 'ROOKIES' : undefined
      const data = await computeAwardRace(currentDef, pool)
      setCandidates(data)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [currentDef, awardType])

  useEffect(() => {
    loadRace()
  }, [loadRace])

  const medalColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Awards Tracker
          <span className="text-xs text-muted-foreground font-normal">{SEASON}</span>
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadRace} />
      </div>

      <Tabs value={awardType} onValueChange={(v) => v && setAwardType(v as 'mvp' | 'cy' | 'roy')}>
        <TabsList className="mb-4">
          <TabsTrigger value="mvp" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> MVP
          </TabsTrigger>
          <TabsTrigger value="cy" className="gap-1.5">
            <Medal className="h-3.5 w-3.5" /> Cy Young
          </TabsTrigger>
          <TabsTrigger value="roy" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> Rookie of the Year
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
        <TabsList>
          {defs.map((d) => (
            <TabsTrigger key={d.id} value={d.id}>{d.label}</TabsTrigger>
          ))}
        </TabsList>

        {defs.map((def) => (
          <TabsContent key={def.id} value={def.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  {def.label} Race — Top 15
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    (based on composite rank across {def.statCategories.map((c) => c.label).join(', ')})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <CardSkeleton count={10} />
                ) : error ? (
                  <ErrorState message="Failed to load award race data" onRetry={loadRace} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs w-8">#</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Player</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs w-10">Team</th>
                          {def.statCategories.map((cat) => (
                            <th key={cat.id} className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">{cat.label}</th>
                          ))}
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c, i) => (
                          <tr key={c.playerId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 text-xs">
                              {i < 3 ? (
                                <span className={`text-sm ${medalColors[i]}`}>
                                  {['🥇', '🥈', '🥉'][i]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{i + 1}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                  <img
                                    src={playerHeadshotUrl(c.playerId, 48)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                                <Link
                                  href={`/players/${c.playerId}`}
                                  className="font-medium text-sm hover:text-primary transition-colors truncate max-w-[160px]"
                                >
                                  {c.playerName}
                                </Link>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1">
                                {TEAM_LOGOS[c.teamAbbreviation] && (
                                  <LogoImage src={TEAM_LOGOS[c.teamAbbreviation]} alt="" className="h-4 w-4" />
                                )}
                                <span className="text-xs text-muted-foreground">{c.teamAbbreviation}</span>
                              </div>
                            </td>
                            {def.statCategories.map((cat) => (
                              <td key={cat.id} className="text-right py-2 px-3 tabular-nums text-xs">
                                <div className="flex flex-col items-end">
                                  <span>{formatStat(cat.id, c.stats[cat.id] ?? 0)}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    #{c.ranks[cat.id] ?? '-'}
                                  </span>
                                </div>
                              </td>
                            ))}
                            <td className="text-right py-2 px-3 tabular-nums font-semibold text-sm">
                              {c.totalScore}
                            </td>
                          </tr>
                        ))}
                        {candidates.length === 0 && (
                          <tr>
                            <td colSpan={def.statCategories.length + 4} className="text-center py-8 text-muted-foreground text-xs">
                              No qualified candidates found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardContent className="py-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong>How scoring works:</strong> Each player earns points based on their rank in each stat category (rank #1 = 30pts, #2 = 29pts, ..., #30 = 1pt).
            Points are summed across all categories. Award results based on actual BBWAA voting, not this composite.
          </p>
        </CardContent>
      </Card>

      <ScrollToTop />
    </div>
  )
}
