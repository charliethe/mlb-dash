'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { fetchStandings } from '@/lib/mlb/api'
import { TEAM_LOGOS, MLB_TEAMS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Download } from 'lucide-react'

const DIVISION_ORDER = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West']

interface TeamStanding {
  team: { id: number; name: string; abbreviation: string }
  leagueRecord: { wins: number; losses: number; pct: string }
  gamesBack: string
  wildCardGamesBack?: string
  streak?: { streakCode: string; streakNumber: number }
  divisionRank?: string
  leagueRank?: string
  runsScored?: number
  runsAllowed?: number
  divisionRecord?: { wins: number; losses: number; pct: string }
  homeRecord?: { wins: number; losses: number; pct: string }
  roadRecord?: { wins: number; losses: number; pct: string }
  last10?: { wins: number; losses: number; pct: string }
}

interface DivisionStanding {
  division: { id: number; name: string; abbreviation: string }
  teamRecords: TeamStanding[]
}

export default function StandingsPage() {
  useEffect(() => { document.title = 'Standings — MLB Research' }, [])
  return (
    <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"><CardSkeleton count={6} /></div>}>
      <StandingsContent />
    </Suspense>
  )
}

function StandingsContent() {
  return (
    <ErrorBoundary name="Standings">
      <StandingsInner />
    </ErrorBoundary>
  )
}

function StandingsInner() {
  const searchParams = useSearchParams()
  const [divisions, setDivisions] = useState<DivisionStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeLeague, setActiveLeague] = useLocalStorage<string>('standings-league', searchParams.get('league') || 'all')
  const [sortKey, setSortKey] = useLocalStorage<string>('standings-sort-key', '')
  const [sortDir, setSortDir] = useLocalStorage<'asc' | 'desc'>('standings-sort-dir', 'asc')

  useEffect(() => {
    loadStandings()
  }, [])

  const abortRef = useRef<AbortController | null>(null)

  async function loadStandings() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(false)

    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const data: any = await fetchStandings(undefined, controller.signal)
      if (controller.signal.aborted) return
      const sorted = (data.records || []).sort((a: any, b: any) => {
        const aIdx = DIVISION_ORDER.indexOf(a.division.name)
        const bIdx = DIVISION_ORDER.indexOf(b.division.name)
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
      })
      setDivisions(sorted)
      setLastUpdated(new Date())
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Failed to load standings:', err)
      setError(true)
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const filtered = activeLeague === 'wildcard'
    ? divisions.filter((d) => d.division.name.startsWith('AL') || d.division.name.startsWith('NL'))
    : activeLeague === 'all'
      ? divisions
      : divisions.filter((d) => d.division.name.startsWith(activeLeague))

  const wildCardTeams = activeLeague === 'wildcard'
    ? (() => {
        const byLeague: Record<string, TeamStanding[]> = {}
        divisions.forEach((d) => {
          const league = d.division.name.startsWith('AL') ? 'AL' : 'NL'
          if (!byLeague[league]) byLeague[league] = []
          d.teamRecords.forEach((t) => {
            if (t.divisionRank !== '1') byLeague[league].push(t)
          })
        })
        for (const league of Object.keys(byLeague)) {
          byLeague[league].sort((a, b) => {
            const ga = a.wildCardGamesBack === '-' || !a.wildCardGamesBack ? 999 : parseFloat(a.wildCardGamesBack)
            const gb = b.wildCardGamesBack === '-' || !b.wildCardGamesBack ? 999 : parseFloat(b.wildCardGamesBack)
            return ga - gb
          })
        }
        return byLeague
      })()
    : null

  function sortTeams(records: TeamStanding[]): TeamStanding[] {
    if (!sortKey) return records
    return [...records].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'w': cmp = a.leagueRecord.wins - b.leagueRecord.wins; break
        case 'l': cmp = a.leagueRecord.losses - b.leagueRecord.losses; break
        case 'pct': cmp = parseFloat(a.leagueRecord.pct) - parseFloat(b.leagueRecord.pct); break
        case 'gb': {
          const ga = a.gamesBack === '-' ? 999 : parseFloat(a.gamesBack)
          const gb = b.gamesBack === '-' ? 999 : parseFloat(b.gamesBack)
          cmp = ga - gb; break
        }
        case 'l10': {
          const la = a.last10 ? a.last10.wins - a.last10.losses : -99
          const lb = b.last10 ? b.last10.wins - b.last10.losses : -99
          cmp = la - lb; break
        }
        case 'strk': {
          const sa = a.streak ? (a.streak.streakCode === 'W' ? a.streak.streakNumber : -a.streak.streakNumber) : 0
          const sb = b.streak ? (b.streak.streakCode === 'W' ? b.streak.streakNumber : -b.streak.streakNumber) : 0
          cmp = sa - sb; break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function exportStandingsCSV() {
    const rows = [['Division', 'Team', 'W', 'L', 'Pct', 'GB', 'L10', 'Strk']]
    filtered.forEach((div) => {
      div.teamRecords.forEach((t) => {
        rows.push([
          div.division.name,
          t.team.abbreviation,
          String(t.leagueRecord.wins),
          String(t.leagueRecord.losses),
          t.leagueRecord.pct,
          t.gamesBack === '-' ? '-' : t.gamesBack,
          t.last10 ? `${t.last10.wins}-${t.last10.losses}` : '-',
          t.streak ? `${t.streak.streakCode}${t.streak.streakNumber}` : '-',
        ])
      })
    })
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `standings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Standings</h1>
        <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadStandings} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {['all', 'AL', 'NL', 'WC'].map((l) => (
            <button
              key={l}
              onClick={() => setActiveLeague(l === 'WC' ? 'wildcard' : l)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                (l === 'WC' ? activeLeague === 'wildcard' : activeLeague === l) ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l === 'WC' ? 'Wild Card' : l}
            </button>
          ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportStandingsCSV} disabled={filtered.length === 0}>
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <CardSkeleton count={6} />
        </div>
      ) : error ? (
        <ErrorState message="Failed to load standings" onRetry={loadStandings} />
      ) : activeLeague === 'wildcard' && wildCardTeams ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(wildCardTeams).map(([league, teams]) => (
            <Card key={league}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {league} Wild Card
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Team</th>
                      <th className="text-right py-2 px-2 font-medium">W</th>
                      <th className="text-right py-2 px-2 font-medium">L</th>
                      <th className="text-right py-2 px-2 font-medium">Pct</th>
                      <th className="text-right py-2 px-3 font-medium">WC GB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t, i) => {
                      const teamInfo = Object.values(MLB_TEAMS).find((mt) => mt.name === t.team.name)
                      const logo = teamInfo ? TEAM_LOGOS[teamInfo.abbreviation] : null
                      const color = teamInfo ? TEAM_COLORS[teamInfo.abbreviation] : undefined
                      return (
                        <tr key={t.team.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-3" style={color ? { borderLeft: `3px solid ${color}80` } : undefined}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                              <LogoImage src={logo} alt={`${t.team.abbreviation} logo`} className="h-4 w-4 shrink-0" />
                              <span className="font-medium truncate max-w-[120px]">{t.team.abbreviation}</span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-2 font-mono">{t.leagueRecord.wins}</td>
                          <td className="text-right py-2 px-2 font-mono">{t.leagueRecord.losses}</td>
                          <td className="text-right py-2 px-2 font-mono">{t.leagueRecord.pct}</td>
                          <td className="text-right py-2 px-3 font-mono">{t.wildCardGamesBack === '-' ? '-' : t.wildCardGamesBack || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No standings data available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((div) => (
            <Card key={div.division.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {div.division.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Team</th>
                        {[{
                          key: 'w', label: 'W', align: 'text-right'
                        }, {
                          key: 'l', label: 'L', align: 'text-right'
                        }, {
                          key: 'pct', label: 'Pct', align: 'text-right'
                        }, {
                          key: 'gb', label: 'GB', align: 'text-right'
                        }, {
                          key: 'l10', label: 'L10', align: 'text-right'
                        }, {
                          key: 'strk', label: 'Strk', align: 'text-right'
                        }].map((col) => (
                          <th
                            key={col.key}
                            className={`${col.align} py-2 px-2 font-medium cursor-pointer hover:text-foreground select-none ${sortKey === col.key ? 'text-foreground' : ''}`}
                            onClick={() => toggleSort(col.key)}
                          >
                            {col.label}
                            {sortKey === col.key && (
                              <span className="text-[10px] ml-0.5">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                        {sortTeams(div.teamRecords).map((t, i) => {
                          const teamInfo = Object.values(MLB_TEAMS).find((mt) => mt.name === t.team.name)
                          const logo = teamInfo ? TEAM_LOGOS[teamInfo.abbreviation] : null
                          const color = teamInfo ? TEAM_COLORS[teamInfo.abbreviation] : undefined
                          return (
                            <tr key={t.team.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                              <td className="py-2 px-3" style={color ? { borderLeft: `3px solid ${color}80` } : undefined}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                  <LogoImage src={logo} alt={`${t.team.abbreviation} logo`} className="h-4 w-4 shrink-0" />
                                  <span className="font-medium truncate max-w-[120px]">{t.team.abbreviation}</span>
                                </div>
                              </td>
                          <td className="text-right py-2 px-2 font-mono">{t.leagueRecord.wins}</td>
                          <td className="text-right py-2 px-2 font-mono">{t.leagueRecord.losses}</td>
                          <td className="text-right py-2 px-2 font-mono">{t.leagueRecord.pct}</td>
                          <td className="text-right py-2 px-2 font-mono">{t.gamesBack === '-' ? '-' : t.gamesBack}</td>
                          <td className="text-right py-2 px-3 font-mono">
                            {t.last10 ? `${t.last10.wins}-${t.last10.losses}` : '-'}
                          </td>
                          <td className="text-right py-2 px-3 font-mono">
                            {t.streak ? (
                              <span className={t.streak.streakCode === 'W' ? 'text-green-400' : 'text-red-400'}>
                                {t.streak.streakCode === 'W' ? 'W' : 'L'}{t.streak.streakNumber}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  )
}
