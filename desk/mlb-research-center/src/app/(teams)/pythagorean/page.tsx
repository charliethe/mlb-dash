'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchStandings, fetchTeamSeasonStats } from '@/lib/mlb/api'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { CsvExportButton } from '@/components/ui/csv-export-button'
import type { TeamSeasonStats } from '@/lib/mlb/api'

interface TeamData {
  id: number
  abbreviation: string
  name: string
  wins: number
  losses: number
  winPct: string
  runsScored: number
  runsAllowed: number
  pythagW: number
  pythagL: number
  luck: number
  runDiff: number
  division: string
  league: string
}

export default function PythagPage() {
  useEffect(() => { document.title = 'Pythagorean Standings — MLB Research' }, [])
  return (
    <ErrorBoundary name="PythagoreanStandings">
      <PythagInner />
    </ErrorBoundary>
  )
}

function PythagInner() {
  const [teams, setTeams] = useState<TeamData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sortKey, setSortKey] = useState<string>('luck')
  const [sortAsc, setSortAsc] = useState(false)
  const [league, setLeague] = useState<'all' | 'AL' | 'NL'>('all')

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
      const teamStatsMap = new Map<number, TeamSeasonStats>()
      const allTeamIds: number[] = []

      for (const record of standings.records) {
        for (const tr of record.teamRecords) {
          const trData = tr as unknown as { team?: { id: number; name: string; abbreviation: string }; wins?: number; losses?: number; leagueRecord?: { pct: string } }
          allTeamIds.push(Number(trData.team?.id))
        }
      }

      const batchSize = 10
      for (let i = 0; i < allTeamIds.length; i += batchSize) {
        const batch = allTeamIds.slice(i, i + batchSize)
        const results = await Promise.allSettled(batch.map(id => fetchTeamSeasonStats(id)))
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            teamStatsMap.set(result.value.teamId, result.value)
          }
        }
      }

      const allTeams: TeamData[] = []
      for (const record of standings.records) {
        const leagueName = record.division.name.includes('American') ? 'AL' : 'NL'
        for (const tr of record.teamRecords) {
          const trData = tr as unknown as { team?: { id: number; name: string; abbreviation: string }; wins?: number; losses?: number; leagueRecord?: { pct: string } }
          const teamId = Number(trData.team?.id)
          const w = Number(trData.wins || 0)
          const l = Number(trData.losses || 0)
          const stats = teamStatsMap.get(teamId)
          const rs = stats?.batting?.runs ?? 0
          const ra = stats?.pitching?.runs ?? 0
          const pythWp = rs + ra > 0 ? (rs * rs) / (rs * rs + ra * ra) : 0.5
          const totalGames = w + l
          const pythW = Math.round(pythWp * totalGames)
          const pythL = totalGames - pythW

          allTeams.push({
            id: teamId,
            abbreviation: String(trData.team?.abbreviation || ''),
            name: String(trData.team?.name || ''),
            wins: w,
            losses: l,
            winPct: String(trData.leagueRecord?.pct || (totalGames > 0 ? (w / totalGames).toFixed(3) : '.000')),
            runsScored: rs,
            runsAllowed: ra,
            pythagW: pythW,
            pythagL: pythL,
            luck: w - pythW,
            runDiff: rs - ra,
            division: record.division.abbreviation,
            league: leagueName,
          })
        }
      }

      setTeams(allTeams.sort((a, b) => b.luck - a.luck))
      setLastUpdated(new Date())
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Failed to load pythagorean data:', err)
      setError(true)
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) setSortAsc(c => !c)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = league === 'all' ? teams : teams.filter(t => t.league === league)
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    const aVal = a[sortKey as keyof TeamData]
    const bVal = b[sortKey as keyof TeamData]
    if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal
    else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal)
    return sortAsc ? cmp : -cmp
  })

  function SortHeader({ label, sort, extraClass }: { label: string; sort: string; extraClass?: string }) {
    const active = sortKey === sort
    return (
      <th
        className={`px-2 py-1.5 text-center font-mono text-muted-foreground font-medium cursor-pointer hover:text-foreground transition-colors ${active ? 'text-foreground' : ''} ${extraClass || ''}`}
        onClick={() => handleSort(sort)}
      >
        {label}
        {active && <span className="ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
      </th>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Pythagorean Standings</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(['all', 'AL', 'NL'] as const).map((l) => (
              <button
                key={l}
                className={`px-2.5 py-1 transition-colors cursor-pointer ${league === l ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setLeague(l)}
              >
                {l === 'all' ? 'All' : l}
              </button>
            ))}
          </div>
          <CsvExportButton
            filename="pythagorean_standings"
            headers={['Team', 'League', 'Division', 'W', 'L', 'W%', 'RS', 'RA', 'Run Diff', 'xW', 'xL', 'Luck']}
            rows={sorted.map((t) => [t.abbreviation, t.league, t.division, t.wins, t.losses, t.winPct, t.runsScored, t.runsAllowed, t.runDiff, t.pythagW, t.pythagL, t.luck])}
          />
          <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadData} />
        </div>
      </div>

      {loading ? (
        <CardSkeleton count={3} />
      ) : error ? (
        <ErrorState message="Failed to load standings data" onRetry={loadData} />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="sticky left-0 bg-muted/20 z-10 px-2 py-1.5 text-left font-medium text-muted-foreground w-8"></th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('abbreviation')}>
                    Team {sortKey === 'abbreviation' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <SortHeader label="W" sort="wins" />
                  <SortHeader label="L" sort="losses" />
                  <SortHeader label="W%" sort="winPct" />
                  <SortHeader label="RS" sort="runsScored" />
                  <SortHeader label="RA" sort="runsAllowed" />
                  <SortHeader label="Run Diff" sort="runDiff" />
                  <SortHeader label="xW" sort="pythagW" extraClass="hidden md:table-cell" />
                  <SortHeader label="xL" sort="pythagL" extraClass="hidden md:table-cell" />
                  <SortHeader label="Luck" sort="luck" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const luckVal = t.luck
                  return (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="sticky left-0 bg-card z-10 px-2 py-1.5">
                    {TEAM_LOGOS[t.abbreviation] && <LogoImage src={TEAM_LOGOS[t.abbreviation]} alt="" className="h-4 w-4" />}
                  </td>
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                    {t.abbreviation}
                    <span className="text-muted-foreground ml-1 font-normal hidden sm:inline">{t.division}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">{t.wins}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{t.losses}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{t.winPct}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{t.runsScored}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{t.runsAllowed}</td>
                  <td className={`hidden sm:table-cell px-2 py-1.5 text-center font-mono ${t.runDiff > 0 ? 'text-green-400' : t.runDiff < 0 ? 'text-red-400' : ''}`}>
                    {t.runDiff > 0 ? '+' : ''}{t.runDiff}
                  </td>
                  <td className="hidden md:table-cell px-2 py-1.5 text-center font-mono">{t.pythagW}</td>
                  <td className="hidden md:table-cell px-2 py-1.5 text-center font-mono">{t.pythagL}</td>
                  <td className={`px-2 py-1.5 text-center font-mono font-semibold ${Math.abs(luckVal) >= 3 ? luckVal > 0 ? 'text-green-400' : 'text-red-400' : ''}`}>
                    <span className="inline-flex items-center gap-1 justify-center">
                      {luckVal > 0 && <TrendingUp className="h-3 w-3 hidden sm:inline" />}
                      {luckVal < 0 && <TrendingDown className="h-3 w-3 hidden sm:inline" />}
                      {luckVal === 0 && <Minus className="h-3 w-3 hidden sm:inline" />}
                      {luckVal > 0 ? '+' : ''}{luckVal}
                    </span>
                  </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <p className="text-[11px] text-muted-foreground px-1">
        Pythagorean expectation: xW = (RS² ÷ (RS² + RA²)) × GP. Luck = Actual W − xW.
      </p>
      <ScrollToTop />
    </div>
  )
}
