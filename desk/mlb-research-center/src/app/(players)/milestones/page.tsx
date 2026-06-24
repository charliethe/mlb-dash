'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchStatLeaders, fetchPlayerCareerStats, getCurrentSeason } from '@/lib/mlb/api'
import { TEAM_LOGOS, playerHeadshotUrl } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Trophy, Target } from 'lucide-react'
import Link from 'next/link'
import type { StatLeaderEntry } from '@/types'

interface MilestoneEntry {
  playerId: number
  playerName: string
  teamAbbreviation: string
  careerValue: number
}

interface MilestoneGroup {
  label: string
  milestone: number
  stat: string
  category: 'hr' | 'hits' | 'rbi' | 'runs' | 'doubles' | 'sb' | 'wins' | 'so' | 'sv' | 'cg'
  playerEntries: MilestoneEntry[]
}

const HITTING_DEFS: { label: string; milestone: number; stat: string; category: MilestoneGroup['category']; leadersCategory: string }[] = [
  { label: '500 HR', milestone: 500, stat: 'HR', category: 'hr', leadersCategory: 'homeRuns' },
  { label: '3000 Hits', milestone: 3000, stat: 'H', category: 'hits', leadersCategory: 'hits' },
  { label: '2000 RBI', milestone: 2000, stat: 'RBI', category: 'rbi', leadersCategory: 'rbi' },
  { label: '2000 Runs', milestone: 2000, stat: 'R', category: 'runs', leadersCategory: 'runs' },
  { label: '600 2B', milestone: 600, stat: '2B', category: 'doubles', leadersCategory: 'doubles' },
  { label: '500 SB', milestone: 500, stat: 'SB', category: 'sb', leadersCategory: 'stolenBases' },
]

const PITCHING_DEFS: { label: string; milestone: number; stat: string; category: MilestoneGroup['category']; leadersCategory: string }[] = [
  { label: '300 Wins', milestone: 300, stat: 'W', category: 'wins', leadersCategory: 'wins' },
  { label: '3000 K', milestone: 3000, stat: 'SO', category: 'so', leadersCategory: 'strikeouts' },
  { label: '300 Saves', milestone: 300, stat: 'SV', category: 'sv', leadersCategory: 'saves' },
  { label: '200 Wins', milestone: 200, stat: 'W', category: 'wins', leadersCategory: 'wins' },
  { label: '2000 K', milestone: 2000, stat: 'SO', category: 'so', leadersCategory: 'strikeouts' },
  { label: '100 CG', milestone: 100, stat: 'CG', category: 'cg', leadersCategory: 'completeGames' },
]

function getCareerValue(careerStats: { batting?: { hr?: number; hits?: number; rbi?: number; runs?: number; doubles?: number; stolenBases?: number }; pitching?: { wins?: number; strikeouts?: number; saves?: number; completeGames?: number } }, category: MilestoneGroup['category'], statGroup: string): number {
  if (statGroup === 'hitting') {
    const s = careerStats.batting
    if (!s) return 0
    switch (category) {
      case 'hr': return s.hr ?? 0
      case 'hits': return s.hits ?? 0
      case 'rbi': return s.rbi ?? 0
      case 'runs': return s.runs ?? 0
      case 'doubles': return s.doubles ?? 0
      case 'sb': return s.stolenBases ?? 0
      default: return 0
    }
  } else {
    const s = careerStats.pitching
    if (!s) return 0
    switch (category) {
      case 'wins': return s.wins ?? 0
      case 'so': return s.strikeouts ?? 0
      case 'sv': return s.saves ?? 0
      case 'cg': return s.completeGames ?? 0
      default: return 0
    }
  }
}

export default function MilestonesPage() {
  useEffect(() => { document.title = 'Milestones — MLB Research' }, [])
  return (
    <ErrorBoundary name="Milestones">
      <MilestonesInner />
    </ErrorBoundary>
  )
}

function MilestonesInner() {
  const [milestones, setMilestones] = useState<MilestoneGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState('hitting')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const defs = activeTab === 'hitting' ? HITTING_DEFS : PITCHING_DEFS
      const statGroup = activeTab === 'hitting' ? 'hitting' : 'pitching'

      const allEntries: StatLeaderEntry[] = []
      const seen = new Set<number>()

      for (const d of defs) {
        const entries = await fetchStatLeaders(d.leadersCategory, 25, getCurrentSeason(), statGroup)
        for (const e of entries) {
          if (!seen.has(e.playerId)) {
            seen.add(e.playerId)
            allEntries.push(e)
          }
        }
      }

      const careerMap = new Map<number, { batting?: { hr?: number; hits?: number; rbi?: number; runs?: number; doubles?: number; stolenBases?: number }; pitching?: { wins?: number; strikeouts?: number; saves?: number; completeGames?: number } }>()

      const batchSize = 10
      const ids = Array.from(seen)
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize)
        const results = await Promise.allSettled(batch.map((id) => fetchPlayerCareerStats(id)))
        for (let j = 0; j < batch.length; j++) {
          const result = results[j]
          if (result.status === 'fulfilled' && result.value) {
            careerMap.set(batch[j], result.value)
          }
        }
      }

      const groups: MilestoneGroup[] = []

      for (const d of defs) {
        const playerEntries: MilestoneEntry[] = []

        for (const entry of allEntries) {
          const careerStats = careerMap.get(entry.playerId)
          if (!careerStats) continue
          const careerValue = getCareerValue(careerStats, d.category, statGroup)
          if (careerValue === 0) continue

          const seasonValue = entry.value
          const threshold = d.milestone * 0.5
          if (careerValue < threshold) continue

          playerEntries.push({
            playerId: entry.playerId,
            playerName: entry.playerName,
            teamAbbreviation: entry.teamAbbreviation,
            careerValue,
          })
        }

        if (playerEntries.length > 0) {
          playerEntries.sort((a, b) => b.careerValue - a.careerValue)
          groups.push({ ...d, playerEntries })
        }
      }

      setMilestones(groups)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Career Milestones</h1>
        </div>
        <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadData} />
      </div>

      <div className="flex gap-1 rounded-lg border border-border overflow-hidden text-xs w-fit">
        {(['hitting', 'pitching'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 transition-colors cursor-pointer capitalize ${
              activeTab === tab ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <CardSkeleton count={6} />
      ) : error ? (
        <ErrorState message="Failed to load milestone data" onRetry={loadData} />
      ) : milestones.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            No active players found approaching career milestones.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {milestones.map((group) => (
            <Card key={group.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-amber-400" />
                  {group.label}
                  <span className="text-muted-foreground font-normal text-[11px] ml-auto">
                    {group.playerEntries.length} qualified
                  </span>
                </CardTitle>
              </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Player</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">{group.stat}</th>
                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">To Go</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.playerEntries.map((entry) => {
                      const remaining = group.milestone - entry.careerValue
                      return (
                        <tr key={entry.playerId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5">
                            <Link href={`/players/${entry.playerId}`} className="flex items-center gap-2 hover:underline">
                              <div className="relative w-5 h-5 shrink-0">
                                <img
                                  src={playerHeadshotUrl(entry.playerId, 40)}
                                  alt={entry.playerName}
                                  className="w-5 h-5 rounded-full object-cover bg-muted"
                                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                                />
                              </div>
                              <span className="font-medium truncate max-w-[120px]">{entry.playerName}</span>
                              {TEAM_LOGOS[entry.teamAbbreviation] && (
                                <LogoImage src={TEAM_LOGOS[entry.teamAbbreviation]} alt={entry.teamAbbreviation} className="h-3 w-3" />
                              )}
                            </Link>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">{entry.careerValue}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            <span className={`${remaining <= 10 ? 'text-green-400 font-semibold' : remaining <= 100 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                              {remaining > 0 ? remaining : 0}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {group.playerEntries.length > 0 && (
                  <div className="p-3">
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-amber-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (group.playerEntries[0].careerValue / group.milestone) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {group.playerEntries[0].playerName}: {group.playerEntries[0].careerValue} / {group.milestone} ({Math.round((group.playerEntries[0].careerValue / group.milestone) * 100)}%)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground px-1">
        Active players at or above 50% of each career milestone based on MLB Stats API career totals.
      </p>
      <ScrollToTop />
    </div>
  )
}
