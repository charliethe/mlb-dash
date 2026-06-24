'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchStandings, fetchTeamSeasonStats } from '@/lib/mlb/api'
import type { TeamSeasonStats } from '@/lib/mlb/api'
import { MLB_TEAMS, TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import Link from 'next/link'
import { BarChart3, ArrowUpDown } from 'lucide-react'

interface TeamRow {
  id: number
  abbr: string
  name: string
  wins: number
  losses: number
  pct: string
  runsScored: number
  runsAllowed: number
  runDiff: number
  stats: TeamSeasonStats['batting'] | undefined
  pitchStats: TeamSeasonStats['pitching'] | undefined
}

type SortKey = 'name' | 'wins' | 'losses' | 'pct' | 'rs' | 'ra' | 'diff' | 'avg' | 'hr' | 'ops' | 'era' | 'whip' | 'so'
type SortDir = 'asc' | 'desc'

const STAT_COLUMNS: { key: SortKey; label: string; group: 'batting' | 'pitching'; getValue: (r: TeamRow) => string | number }[] = [
  { key: 'avg', label: 'AVG', group: 'batting', getValue: (r) => r.stats?.avg || '-' },
  { key: 'hr', label: 'HR', group: 'batting', getValue: (r) => r.stats?.hr ?? 0 },
  { key: 'ops', label: 'OPS', group: 'batting', getValue: (r) => r.stats?.ops || '-' },
  { key: 'era', label: 'ERA', group: 'pitching', getValue: (r) => r.pitchStats?.era || '-' },
  { key: 'whip', label: 'WHIP', group: 'pitching', getValue: (r) => r.pitchStats?.whip || '-' },
  { key: 'so', label: 'K', group: 'pitching', getValue: (r) => r.pitchStats?.so ?? 0 },
]

export default function TeamStatsPage() {
  useEffect(() => { document.title = 'Team Stats — MLB Research' }, [])
  return (
    <ErrorBoundary name="TeamStats">
      <TeamStatsInner />
    </ErrorBoundary>
  )
}

function TeamStatsInner() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tab, setTab] = useState<'overview' | 'batting' | 'pitching'>('overview')

  useEffect(() => {
    loadTeamStats()
  }, [])

  const abortRef = useRef<AbortController | null>(null)

  async function loadTeamStats() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(false)

    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const standingsData = await fetchStandings(undefined, controller.signal)
      if (controller.signal.aborted) return
      const allRecords: Record<string, unknown>[] = []
      for (const div of standingsData.records) {
        for (const tr of div.teamRecords) {
          allRecords.push(tr)
        }
      }

      const teamIds = Object.keys(MLB_TEAMS).map(Number)

      const statsMap = new Map<number, TeamSeasonStats>()
      for (let i = 0; i < teamIds.length; i += 10) {
        const batch = teamIds.slice(i, i + 10)
        const results = await Promise.all(
          batch.map((id) => fetchTeamSeasonStats(id))
        )
        for (const s of results) statsMap.set(s.teamId, s)
        if (i + 10 < teamIds.length) await new Promise((r) => setTimeout(r, 200))
      }

      const rows: TeamRow[] = allRecords.map((r) => {
        const team = r.team as Record<string, unknown> | undefined
        const id = Number(team?.id || 0)
        const lr = r.leagueRecord as Record<string, unknown> | undefined
        const s = statsMap.get(id)
        return {
          id,
          abbr: String(team?.abbreviation || ''),
          name: String(team?.name || ''),
          wins: Number(lr?.wins || 0),
          losses: Number(lr?.losses || 0),
          pct: String(lr?.pct || ''),
          runsScored: Number(r.runsScored || 0),
          runsAllowed: Number(r.runsAllowed || 0),
          runDiff: Number(r.runsScored || 0) - Number(r.runsAllowed || 0),
          stats: s?.batting,
          pitchStats: s?.pitching,
        }
      })

      setTeams(rows)
      setLastUpdated(new Date())
    } catch {
      if (controller.signal.aborted) return
      setError(true)
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortValue(r: TeamRow, key: SortKey): number | string {
    switch (key) {
      case 'name': return r.name
      case 'wins': return r.wins
      case 'losses': return r.losses
      case 'pct': return parseFloat(r.pct) || 0
      case 'rs': return r.runsScored
      case 'ra': return r.runsAllowed
      case 'diff': return r.runDiff
      case 'avg': return r.stats?.avg || '0'
      case 'hr': return r.stats?.hr ?? 0
      case 'ops': return r.stats?.ops || '0'
      case 'era': return r.pitchStats?.era || '99'
      case 'whip': return r.pitchStats?.whip || '99'
      case 'so': return r.pitchStats?.so ?? 0
    }
  }

  const sorted = [...teams].sort((a, b) => {
    const aVal = sortValue(a, sortKey)
    const bVal = sortValue(b, sortKey)
    const cmp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortHeader({ label, sortKey: k, className }: { label: string; sortKey: SortKey; className?: string }) {
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ${className || ''}`}
      >
        {label}
        {sortKey === k && (
          <ArrowUpDown className={`h-3 w-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
        )}
      </button>
    )
  }

  function sortableCols(): { label: string; key: SortKey; className?: string }[] {
    if (tab === 'overview') {
      return [
        { label: 'Team', key: 'name', className: 'text-left flex-1 min-w-0' },
        { label: 'W', key: 'wins' },
        { label: 'L', key: 'losses' },
        { label: 'Pct', key: 'pct' },
        { label: 'R', key: 'rs' },
        { label: 'RA', key: 'ra' },
        { label: 'Diff', key: 'diff' },
      ]
    }
    const prefix = [
      { label: 'Team', key: 'name' as SortKey, className: 'text-left flex-1 min-w-0' },
      { label: 'W', key: 'wins' as SortKey },
      { label: 'L', key: 'losses' as SortKey },
    ]
    const statCols = STAT_COLUMNS.filter((c) => c.group === tab).map((c) => ({
      label: c.label,
      key: c.key,
    }))
    return [...prefix, ...statCols]
  }

  if (loading) return <CardSkeleton count={15} />
  if (error) return <ErrorState message="Failed to load team stats" onRetry={loadTeamStats} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Team Stats
        </h1>
        <div className="flex items-center gap-2">
          <FreshnessIndicator lastUpdated={lastUpdated} />
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={loadTeamStats}>
            <ArrowUpDown className="h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="overview" className="text-xs px-3 py-1 h-8">Overview</TabsTrigger>
              <TabsTrigger value="batting" className="text-xs px-3 py-1 h-8">Batting</TabsTrigger>
              <TabsTrigger value="pitching" className="text-xs px-3 py-1 h-8">Pitching</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {sortableCols().map((col) => (
                  <th key={col.key} className={`px-3 py-2 ${col.className || 'text-right'}`}>
                    <SortHeader label={col.label} sortKey={col.key} />
                  </th>
                ))}
                <th className="px-3 py-2 text-right">
                  <span className="text-xs font-medium text-muted-foreground">Streak</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const color = TEAM_COLORS[row.abbr] || '#666'
                return (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/teams/${row.id}`} className="flex items-center gap-2 min-w-0 group">
                        {TEAM_LOGOS[row.abbr] && <LogoImage src={TEAM_LOGOS[row.abbr]} alt={row.abbr} className="h-5 w-5 shrink-0" />}
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{row.abbr}</span>
                        <div className="w-0.5 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.losses}</td>
                    {tab === 'overview' && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{parseFloat(row.pct).toFixed(3).slice(1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.runsScored}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.runsAllowed}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${row.runDiff > 0 ? 'text-green-400' : row.runDiff < 0 ? 'text-red-400' : ''}`}>
                          {row.runDiff > 0 ? '+' : ''}{row.runDiff}
                        </td>
                      </>
                    )}
                    {tab === 'batting' && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{row.stats?.avg || '-'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.stats?.hr ?? '-'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.stats?.ops || '-'}</td>
                      </>
                    )}
                    {tab === 'pitching' && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{row.pitchStats?.era || '-'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.pitchStats?.whip || '-'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.pitchStats?.so ?? '-'}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                      {row.wins}-{row.losses}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ScrollToTop />
    </div>
  )
}
