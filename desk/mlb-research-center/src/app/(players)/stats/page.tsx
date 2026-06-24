'use client'

import { useState, useEffect } from 'react'
import { fetchStatLeaders } from '@/lib/mlb/api'
import { TEAM_LOGOS, TEAM_COLORS, MLB_TEAMS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import Link from 'next/link'
import { Trophy, TrendingUp, ArrowUpDown } from 'lucide-react'
import { CsvExportButton } from '@/components/ui/csv-export-button'
import type { StatLeaderEntry } from '@/types'

const HITTING_CATEGORIES = [
  { id: 'battingAverage', label: 'AVG' },
  { id: 'homeRuns', label: 'HR' },
  { id: 'runsBattedIn', label: 'RBI' },
  { id: 'onBasePlusSlugging', label: 'OPS' },
  { id: 'onBasePercentage', label: 'OBP' },
  { id: 'sluggingPercentage', label: 'SLG' },
  { id: 'runs', label: 'R' },
  { id: 'hits', label: 'H' },
  { id: 'doubles', label: '2B' },
  { id: 'triples', label: '3B' },
  { id: 'walks', label: 'BB' },
  { id: 'stolenBases', label: 'SB' },
]

const PITCHING_CATEGORIES = [
  { id: 'earnedRunAverage', label: 'ERA' },
  { id: 'wins', label: 'W' },
  { id: 'strikeoutsPitching', label: 'K' },
  { id: 'whip', label: 'WHIP' },
  { id: 'saves', label: 'SV' },
  { id: 'holds', label: 'HLD' },
  { id: 'inningsPitched', label: 'IP' },
  { id: 'gamesPitched', label: 'G' },
  { id: 'completeGames', label: 'CG' },
  { id: 'shutouts', label: 'SHO' },
]

export default function StatsPage() {
  useEffect(() => { document.title = 'Stat Explorer — MLB Research' }, [])
  return (
    <ErrorBoundary name="StatExplorer">
      <StatsExplorer />
    </ErrorBoundary>
  )
}

function StatsExplorer() {
  const [statGroup, setStatGroup] = useState<'hitting' | 'pitching'>('hitting')
  const [category, setCategory] = useState(HITTING_CATEGORIES[0].id)
  const [league, setLeague] = useState<string>('')
  const [leaders, setLeaders] = useState<StatLeaderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const categories = statGroup === 'hitting' ? HITTING_CATEGORIES : PITCHING_CATEGORIES
  const maxValue = leaders.length > 0 ? Math.max(...leaders.map((l) => l.value)) : 1

  useEffect(() => {
    loadLeaders()
  }, [category, statGroup, league])

  async function loadLeaders() {
    setLoading(true)
    setError(false)
    try {
      const leagueId = league === 'AL' ? '103' : league === 'NL' ? '104' : undefined
      const data = await fetchStatLeaders(category, 50, undefined, statGroup, leagueId)
      setLeaders(data)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Stat Explorer
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={statGroup} onValueChange={(v) => {
              const group = v as 'hitting' | 'pitching'
              setStatGroup(group)
              setCategory(group === 'hitting' ? HITTING_CATEGORIES[0].id : PITCHING_CATEGORIES[0].id)
            }} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="hitting" className="text-xs px-3 py-1 h-8">Hitting</TabsTrigger>
                <TabsTrigger value="pitching" className="text-xs px-3 py-1 h-8">Pitching</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-1.5 flex-wrap">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={category === cat.id ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-xs ${category === cat.id ? '' : 'text-muted-foreground'}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            <div className="flex gap-1.5 ml-auto">
              {['', 'AL', 'NL'].map((l) => (
                <Button
                  key={l}
                  variant={league === l ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-xs ${league === l ? '' : 'text-muted-foreground'}`}
                  onClick={() => setLeague(l)}
                >
                  {l || 'All'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              {HITTING_CATEGORIES.find((c) => c.id === category)?.label ||
               PITCHING_CATEGORIES.find((c) => c.id === category)?.label || category}
              {' '}Leaders
            </CardTitle>
            <div className="flex items-center gap-1">
              <CsvExportButton
                filename={`stat_leaders_${category}`}
                headers={['Rank', 'Player', 'Team', 'Value']}
                rows={leaders.map((l) => [l.rank, l.playerName, l.teamAbbreviation, l.value])}
              />
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={loadLeaders}>
                <ArrowUpDown className="h-3 w-3" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <CardSkeleton count={10} />
          ) : error ? (
            <ErrorState message="Failed to load leaders" onRetry={loadLeaders} />
          ) : leaders.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No data available for this category.</div>
          ) : (
            <div className="divide-y divide-border">
              {leaders.map((entry) => {
                const pct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0
                const color = TEAM_COLORS[entry.teamAbbreviation] || '#666'
                const teamInfo = Object.values(MLB_TEAMS).find((t) => t.abbreviation === entry.teamAbbreviation)
                return (
                  <Link
                    key={`${entry.playerId}-${category}`}
                    href={`/players/${entry.playerId}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                  >
                    <span className="text-xs text-muted-foreground w-5 text-right font-mono">{entry.rank}</span>
                    <div className="relative w-7 h-7 shrink-0">
                      <img
                        src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_60,q_auto:best/v1/people/${entry.playerId}/headshot/silo/current`}
                        alt={entry.playerName}
                        className="w-7 h-7 rounded-full object-cover bg-muted"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget
                          target.style.display = 'none'
                          if (target.parentElement) {
                            const fallback = document.createElement('div')
                            fallback.className = 'w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium'
                            fallback.textContent = entry.playerName.split(' ').map((s) => s[0]).join('').slice(0, 2)
                            target.parentElement.appendChild(fallback)
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {entry.playerName}
                        </span>
                        {teamInfo && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {teamInfo.name}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {TEAM_LOGOS[entry.teamAbbreviation] && (
                        <LogoImage src={TEAM_LOGOS[entry.teamAbbreviation]} alt={entry.teamAbbreviation} className="h-4 w-4" />
                      )}
                      <span className="text-sm font-semibold font-mono tabular-nums w-16 text-right">
                        {formatStatValue(category, entry.value)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ScrollToTop />
    </div>
  )
}

function formatStatValue(category: string, value: number): string {
  if (['battingAverage', 'onBasePercentage', 'sluggingPercentage', 'onBasePlusSlugging', 'earnedRunAverage', 'whip'].includes(category)) {
    return value.toFixed(3)
  }
  if (['inningsPitched'].includes(category)) {
    return value.toFixed(1)
  }
  return String(Math.round(value))
}
