'use client'

import { useState, useEffect } from 'react'
import { fetchTeams, getCurrentSeason } from '@/lib/mlb/api'
import { TEAM_LOGOS, MLB_API_BASE } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { GitCompare, Search } from 'lucide-react'
import { CsvExportButton } from '@/components/ui/csv-export-button'
import { Input } from '@/components/ui/input'
import type { MLBTeam } from '@/types'

interface H2HRecord {
  teamId: number
  abbr: string
  wins: number
  losses: number
}

interface TeamH2H {
  teamId: number
  abbr: string
  records: Map<number, H2HRecord>
}

export default function H2HMatrixPage() {
  useEffect(() => { document.title = 'Head-to-Head Matrix — MLB Research' }, [])
  return (
    <ErrorBoundary name="H2HMatrix">
      <H2HInner />
    </ErrorBoundary>
  )
}

function H2HInner() {
  const [teams, setTeams] = useState<MLBTeam[]>([])
  const [matrix, setMatrix] = useState<Map<number, Map<number, { w: number; l: number }>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const allTeams = await fetchTeams()
      const mlbTeams = allTeams.filter(t => t.league?.name?.includes('American') || t.league?.name?.includes('National'))
      setTeams(mlbTeams)

      const season = getCurrentSeason()
      const h2h = new Map<number, Map<number, { w: number; l: number }>>()
      for (const team of mlbTeams) h2h.set(team.id, new Map())

      const monthRanges = [
        { start: `${season}-03-20`, end: `${season}-04-30` },
        { start: `${season}-05-01`, end: `${season}-05-31` },
        { start: `${season}-06-01`, end: `${season}-06-30` },
        { start: `${season}-07-01`, end: `${season}-07-31` },
        { start: `${season}-08-01`, end: `${season}-08-31` },
        { start: `${season}-09-01`, end: `${season}-10-31` },
      ]

      for (const range of monthRanges) {
        const res = await fetch(
          `${MLB_API_BASE}/schedule?sportId=1&season=${season}&startDate=${range.start}&endDate=${range.end}&hydrate=team(leagueRecord)`
        )
        const data = await res.json()
        if (!data.dates) continue

        for (const date of data.dates) {
          if (!date.games) continue
          for (const game of date.games) {
            if (game.status?.abstractGameState !== 'Final') continue
            const awayTeam = game.teams?.away?.team?.id
            const homeTeam = game.teams?.home?.team?.id
            const awayScore = game.teams?.away?.score
            const homeScore = game.teams?.home?.score
            if (!awayTeam || !homeTeam || awayScore == null || homeScore == null) continue

            const awayRecord = h2h.get(awayTeam)
            const homeRecord = h2h.get(homeTeam)
            if (awayRecord) {
              const entry = awayRecord.get(homeTeam) || { w: 0, l: 0 }
              if (awayScore > homeScore) entry.w++
              else entry.l++
              awayRecord.set(homeTeam, entry)
            }
            if (homeRecord) {
              const entry = homeRecord.get(awayTeam) || { w: 0, l: 0 }
              if (homeScore > awayScore) entry.w++
              else entry.l++
              homeRecord.set(awayTeam, entry)
            }
          }
        }
      }

      setMatrix(h2h)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const sortedTeams = teams
    .filter(t => !search || t.abbreviation.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Head-to-Head Matrix</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter teams..."
              className="pl-7 h-7 w-32 text-xs"
            />
          </div>
          <CsvExportButton
            filename="h2h_matrix"
            headers={['Team', ...teams.map((t) => t.abbreviation)]}
            rows={teams.map((team) => {
              const row: (string | number)[] = [team.abbreviation]
              for (const opp of teams) {
                const h2h = matrix.get(team.id)?.get(opp.id)
                row.push(h2h ? `${h2h.w}-${h2h.l}` : '-')
              }
              return row
            })}
          />
          <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadData} />
        </div>
      </div>

      {loading ? (
        <CardSkeleton count={3} />
      ) : error ? (
        <ErrorState message="Failed to load schedule data" onRetry={loadData} />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="sticky left-0 bg-muted/20 z-10 px-2 py-1.5 text-left font-medium text-muted-foreground w-8"></th>
                  <th className="sticky left-8 bg-muted/20 z-10 px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[40px]">Team</th>
                  {sortedTeams.map((t) => (
                    <th key={t.id} className="px-1 py-1.5 text-center font-mono text-muted-foreground font-medium text-[10px] min-w-[28px]">
                      {TEAM_LOGOS[t.abbreviation] ? (
                        <div className="flex justify-center">
                          <LogoImage src={TEAM_LOGOS[t.abbreviation]} alt={t.abbreviation} className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        t.abbreviation.slice(0, 3)
                      )}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center font-mono text-muted-foreground font-medium w-8">W%</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => {
                  const teamH2H = matrix.get(team.id)
                  let totalW = 0, totalL = 0
                  const row: { id: number; w: number; l: number }[] = []
                  for (const opp of sortedTeams) {
                    if (opp.id === team.id) { row.push({ id: opp.id, w: 0, l: 0 }); continue }
                    const rec = teamH2H?.get(opp.id)
                    const w = rec?.w ?? 0
                    const l = rec?.l ?? 0
                    row.push({ id: opp.id, w, l })
                    totalW += w; totalL += l
                  }

                  return (
                    <tr key={team.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="sticky left-0 bg-card z-10 px-2 py-1">
                        {TEAM_LOGOS[team.abbreviation] && <LogoImage src={TEAM_LOGOS[team.abbreviation]} alt="" className="h-4 w-4" />}
                      </td>
                      <td className="sticky left-8 bg-card z-10 px-2 py-1 font-medium whitespace-nowrap text-xs">
                        {team.abbreviation}
                      </td>
                      {row.map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-1 py-1 text-center font-mono text-[11px] ${
                            cell.w > cell.l ? 'text-green-400 font-medium' :
                            cell.l > cell.w ? 'text-red-400' :
                            cell.w === 0 && cell.l === 0 ? 'text-muted-foreground/30' :
                            'text-muted-foreground'
                          }`}
                        >
                          {cell.w || cell.l ? `${cell.w}-${cell.l}` : '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-center font-mono text-[11px] font-semibold">
                        {totalW + totalL > 0 ? (totalW / (totalW + totalL)).toFixed(3).slice(1) : '.000'}
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
        Read across to see a team&apos;s record against each opponent. Green = winning record.
      </p>
      <ScrollToTop />
    </div>
  )
}
