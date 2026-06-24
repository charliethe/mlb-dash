'use client'

import { useState, useEffect } from 'react'
import { fetchTeamRoster } from '@/lib/mlb/api'
import { MLB_TEAMS, TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { getCache, setCache } from '@/lib/cache'
import Link from 'next/link'
import { Activity, Search } from 'lucide-react'
import type { RosterPlayer } from '@/types'

const IL_LABELS: Record<string, string> = {
  'il-7': '7-Day IL',
  'il-10': '10-Day IL',
  'il-15': '15-Day IL',
  'il-60': '60-Day IL',
}

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'RP', 'SP']

export default function InjuriesPage() {
  useEffect(() => { document.title = 'Injury Report — MLB Research' }, [])
  return (
    <ErrorBoundary name="InjuryReport">
      <InjuryReport />
    </ErrorBoundary>
  )
}

function InjuryReport() {
  const [players, setPlayers] = useState<(RosterPlayer & { teamAbbreviation: string; teamId: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [teamFilter, setTeamFilter] = useState('')
  const [ilFilter, setIlFilter] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadInjuries()
  }, [])

  async function loadInjuries() {
    setLoading(true)
    setError(false)
    try {
      const cached = getCache<(RosterPlayer & { teamAbbreviation: string; teamId: number })[]>('injury-report')
      if (cached) {
        setPlayers(cached)
        setLastUpdated(new Date())
        setLoading(false)
        return
      }

      const teams = Object.entries(MLB_TEAMS)
      const result: (RosterPlayer & { teamAbbreviation: string; teamId: number })[] = []

      for (let i = 0; i < teams.length; i += 5) {
        const batch = teams.slice(i, i + 5)
        const rosters = await Promise.all(
          batch.map(([id, info]) =>
            fetchTeamRoster(Number(id)).then((roster) => {
              return roster
                .filter((p) => p.status.startsWith('il'))
                .map((p) => ({ ...p, teamAbbreviation: info.abbreviation, teamId: Number(id) }))
            }).catch(() => [] as (RosterPlayer & { teamAbbreviation: string; teamId: number })[])
          )
        )
        for (const r of rosters) result.push(...r)
        if (i + 5 < teams.length) await new Promise((r) => setTimeout(r, 200))
      }

      result.sort((a, b) => a.status.localeCompare(b.status) || a.fullName.localeCompare(b.fullName))
      setPlayers(result)
      setCache('injury-report', result, 15)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const uniqueTeams = [...new Set(players.map((p) => p.teamAbbreviation))].sort()
  const ilTypes = [...new Set(players.map((p) => p.status))].filter((s) => s.startsWith('il')).sort()

  const filtered = players.filter((p) => {
    if (teamFilter && p.teamAbbreviation !== teamFilter) return false
    if (ilFilter && p.status !== ilFilter) return false
    if (posFilter) {
      const pos = posFilter
      if (pos === 'P' && p.position !== 'P') return false
      if (pos === 'SP' && p.position !== 'SP') return false
      if (pos === 'RP' && p.position !== 'RP') return false
      if (!['P', 'SP', 'RP'].includes(pos) && p.position !== pos) return false
    }
    if (search && !p.fullName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, p) => {
    if (!acc[p.teamAbbreviation]) acc[p.teamAbbreviation] = []
    acc[p.teamAbbreviation].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Injury Report
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Teams</option>
              {uniqueTeams.map((abbr) => (
                <option key={abbr} value={abbr}>{abbr}</option>
              ))}
            </select>

            <select
              value={ilFilter}
              onChange={(e) => setIlFilter(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All IL Types</option>
              {ilTypes.map((type) => (
                <option key={type} value={type}>{IL_LABELS[type] || type}</option>
              ))}
            </select>

            <select
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Positions</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>

            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadInjuries}>Refresh</Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <CardSkeleton count={12} />
      ) : error ? (
        <ErrorState message="Failed to load injury report" onRetry={loadInjuries} />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            {players.length === 0 ? 'No players currently on IL.' : 'No players match your filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(grouped).sort().map(([abbr, ilPlayers]) => (
            <Card key={abbr}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {TEAM_LOGOS[abbr] && <LogoImage src={TEAM_LOGOS[abbr]} alt={abbr} className="h-5 w-5" />}
                  <CardTitle className="text-sm font-medium">{MLB_TEAMS[Object.entries(MLB_TEAMS).find(([, v]) => v.abbreviation === abbr)?.[0] as unknown as number]?.name || abbr}</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">{ilPlayers.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {ilPlayers.map((p) => (
                    <Link
                      key={`${p.teamId}-${p.playerId}`}
                      href={`/players/${p.playerId}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="relative w-7 h-7 shrink-0">
                        <img
                          src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_60,q_auto:best/v1/people/${p.playerId}/headshot/silo/current`}
                          alt={p.fullName}
                          className="w-7 h-7 rounded-full object-cover bg-muted"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = 'none'
                            if (target.parentElement) {
                              const fallback = document.createElement('div')
                              fallback.className = 'w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium'
                              fallback.textContent = p.fullName.split(' ').map((s) => s[0]).join('').slice(0, 2)
                              target.parentElement.appendChild(fallback)
                            }
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {p.fullName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{p.position}</span>
                          <span className="text-[11px] text-muted-foreground">#{p.jerseyNumber || '-'}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${
                        p.status === 'il-60' ? 'border-red-500/30 text-red-400' :
                        p.status === 'il-15' ? 'border-amber-500/30 text-amber-400' :
                        'border-yellow-500/30 text-yellow-400'
                      }`}>
                        {IL_LABELS[p.status] || p.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  )
}
