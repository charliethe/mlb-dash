'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { MLB_TEAMS, TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { fetchStandings } from '@/lib/mlb/api'
import { X } from 'lucide-react'

interface TeamRecord {
  team: { id: number; name: string }
  leagueRecord: { wins: number; losses: number; pct: string }
  gamesBack: string
  wildCardGamesBack?: string
  streak?: { streakCode: string; streakNumber: number }
  last10?: { wins: number; losses: number; pct: string }
  runsScored?: number
  runsAllowed?: number
  homeRecord?: { wins: number; losses: number; pct: string }
  roadRecord?: { wins: number; losses: number; pct: string }
}

export function TeamCompare() {
  const [records, setRecords] = useState<TeamRecord[]>([])
  const [selected, setSelected] = useState<TeamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const allRecords = await fetchStandings()
        if (!cancelled) setRecords(allRecords.records.flatMap((r) => r.teamRecords) as unknown as TeamRecord[])
      } catch (err) {
        console.error('Failed to load standings:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function addTeam(id: string) {
    const t = records.find((r) => String(r.team.id) === id)
    if (t && !selected.some((s) => s.team.id === t.team.id)) {
      setSelected((prev) => [...prev, t])
    }
    setAdding(false)
  }

  function removeTeam(id: number) {
    setSelected((prev) => prev.filter((t) => t.team.id !== id))
  }

  function getValue(t: TeamRecord, key: string): string {
    switch (key) {
      case 'wins': return String(t.leagueRecord.wins)
      case 'losses': return String(t.leagueRecord.losses)
      case 'pct': return t.leagueRecord.pct
      case 'gamesBack': return t.gamesBack === '-' ? '—' : t.gamesBack
      case 'wildCardGamesBack': return t.wildCardGamesBack === '-' ? '—' : t.wildCardGamesBack || '—'
      case 'last10Str': return t.last10 ? `${t.last10.wins}-${t.last10.losses}` : '-'
      case 'strkStr': return t.streak ? `${t.streak.streakCode}${t.streak.streakNumber}` : '-'
      case 'runsScored': return String(t.runsScored ?? '-')
      case 'runsAllowed': return String(t.runsAllowed ?? '-')
      case 'runDiff': return t.runsScored != null && t.runsAllowed != null ? String(t.runsScored - t.runsAllowed) : '-'
      case 'homeW': return String(t.homeRecord?.wins ?? '-')
      case 'homeL': return String(t.homeRecord?.losses ?? '-')
      case 'roadW': return String(t.roadRecord?.wins ?? '-')
      case 'roadL': return String(t.roadRecord?.losses ?? '-')
      default: return '-'
    }
  }

  if (loading) return <Skeleton className="h-48 rounded-lg" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Select Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {adding ? (
            <Select onValueChange={(v: string | null) => v && addTeam(v)}>
              <SelectTrigger className="w-full h-9 text-xs" aria-label="Choose a team to compare">
                <SelectValue placeholder="Choose a team..." />
              </SelectTrigger>
              <SelectContent>
                {records.filter((r) => !selected.some((s) => s.team.id === r.team.id)).map((r) => {
                  const teamInfo = Object.values(MLB_TEAMS).find((t) => t.name === r.team.name)
                  return (
                    <SelectItem key={r.team.id} value={String(r.team.id)} className="text-xs">
                      <span className="flex items-center gap-2">
                        {teamInfo && TEAM_LOGOS[teamInfo.abbreviation] && (
                          <LogoImage src={TEAM_LOGOS[teamInfo.abbreviation]} alt={`${teamInfo.abbreviation} logo`} className="h-4 w-4" />
                        )}
                        {teamInfo?.abbreviation || r.team.name}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAdding(true)}>
              + Add Team
            </Button>
          )}
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground w-24">Stat</th>
                {selected.map((t) => {
                  const teamInfo = Object.values(MLB_TEAMS).find((ti) => ti.name === t.team.name)
                  const color = teamInfo ? TEAM_COLORS[teamInfo.abbreviation] : undefined
                  return (
                    <th key={t.team.id} className="py-2 px-2 min-w-[100px]" style={color ? { borderTop: `3px solid ${color}` } : undefined}>
                      <div className="flex items-center gap-1.5">
                        {teamInfo && TEAM_LOGOS[teamInfo.abbreviation] && (
                          <LogoImage src={TEAM_LOGOS[teamInfo.abbreviation]} alt={`${teamInfo.abbreviation} logo`} className="h-4 w-4 shrink-0" />
                        )}
                        <span className="font-medium truncate">{teamInfo?.abbreviation || t.team.name}</span>
                        <button aria-label={`Remove ${teamInfo?.abbreviation || t.team.name} from comparison`} onClick={() => removeTeam(t.team.id)} className="shrink-0 text-muted-foreground hover:text-foreground ml-auto cursor-pointer">
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'W', key: 'wins' },
                { label: 'L', key: 'losses' },
                { label: 'Pct', key: 'pct' },
                { label: 'GB', key: 'gamesBack' },
                { label: 'WC GB', key: 'wildCardGamesBack' },
                { label: 'L10', key: 'last10Str' },
                { label: 'Streak', key: 'strkStr' },
                { label: 'RS', key: 'runsScored' },
                { label: 'RA', key: 'runsAllowed' },
                { label: 'Run Diff', key: 'runDiff' },
              ].map((row) => (
                <tr key={row.key} className="border-b border-border/30">
                  <td className="py-1.5 px-2 text-muted-foreground font-medium">{row.label}</td>
                  {selected.map((t) => (
                    <td key={t.team.id} className="py-1.5 px-2 font-mono text-center">{getValue(t, row.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Add teams above to compare their statistics side by side</p>
      )}
    </div>
  )
}
