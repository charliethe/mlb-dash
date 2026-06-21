'use client'

import { useState, useMemo, useCallback, useEffect, startTransition } from 'react'
import Link from 'next/link'
import type { RosterPlayer, BattingStats, PitchingStats } from '@/types'
import { fetchTeamRoster, fetchBulkPlayerStats } from '@/lib/mlb/api'
import { MLB_TEAMS } from '@/lib/mlb/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Download, ChevronDown } from 'lucide-react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { LogoImage } from '@/components/ui/logo-image'
import { TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  'il-7': 'bg-red-500/10 text-red-400 border-red-500/30',
  'il-10': 'bg-red-500/10 text-red-400 border-red-500/30',
  'il-15': 'bg-red-500/10 text-red-400 border-red-500/30',
  'il-60': 'bg-red-500/10 text-red-400 border-red-500/30',
  minors: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  dfa: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  suspended: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

export function RosterView() {
  const [teamId, setTeamId] = useLocalStorage<string>('roster-team-id', '147')
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sortKey, setSortKey] = useLocalStorage<string>('roster-sort-key', 'name')
  const [sortDir, setSortDir] = useLocalStorage<'asc' | 'desc'>('roster-sort-dir', 'asc')
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('all')
  const [btFilter, setBtFilter] = useState<string>('all')
  const [activeExpanded, setActiveExpanded] = useState(true)
  const [ilExpanded, setIlExpanded] = useState(true)
  const [otherExpanded, setOtherExpanded] = useState(true)

  const loadRoster = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchTeamRoster(Number(teamId))
      const ids = data.filter((p) => p.status === 'active').map((p) => p.playerId)
      if (ids.length > 0) {
        const stats = await fetchBulkPlayerStats(ids)
        for (const player of data) {
          const s = stats.get(player.playerId)
          if (s) player.seasonStats = s
        }
      }
      setRoster(data)
    } catch (err) {
      console.error('Failed to load roster:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => { startTransition(() => { loadRoster() }) }, [loadRoster])

  function exportCSV() {
    const headers = ['Name', 'Position', 'B/T', 'Status', 'Jersey']
    const rows = roster.map((p) => [
      p.fullName,
      p.position,
      p.bats && p.throws ? `${p.bats}/${p.throws}` : p.bats || p.throws || '',
      p.status,
      p.jerseyNumber || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roster-${teamId}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const teamOptions = Object.entries(MLB_TEAMS).map(([id, t]) => ({
    id,
    label: `${t.abbreviation} - ${t.name}`,
  }))

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'avg', label: 'AVG' },
    { value: 'hr', label: 'HR' },
    { value: 'rbi', label: 'RBI' },
    { value: 'era', label: 'ERA' },
    { value: 'w', label: 'W' },
    { value: 'k', label: 'K' },
  ]

  const sortPlayers = useCallback((list: RosterPlayer[]): RosterPlayer[] => {
    return [...list].sort((a, b) => {
      const sa = a.seasonStats
      const sb = b.seasonStats
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.fullName.localeCompare(b.fullName)
          break
        case 'avg': {
          const va = sa?.type === 'batting' ? parseFloat(sa.avg || '0') : -1
          const vb = sb?.type === 'batting' ? parseFloat(sb.avg || '0') : -1
          cmp = va - vb
          break
        }
        case 'hr': {
          const va = sa?.type === 'batting' ? (sa.hr ?? 0) : -1
          const vb = sb?.type === 'batting' ? (sb.hr ?? 0) : -1
          cmp = va - vb
          break
        }
        case 'rbi': {
          const va = sa?.type === 'batting' ? (sa.rbi ?? 0) : -1
          const vb = sb?.type === 'batting' ? (sb.rbi ?? 0) : -1
          cmp = va - vb
          break
        }
        case 'era': {
          const va = sa?.type === 'pitching' ? parseFloat(sa.era || '99') : 99
          const vb = sb?.type === 'pitching' ? parseFloat(sb.era || '99') : 99
          cmp = va - vb
          break
        }
        case 'w': {
          const va = sa?.type === 'pitching' ? (sa.wins ?? 0) : -1
          const vb = sb?.type === 'pitching' ? (sb.wins ?? 0) : -1
          cmp = va - vb
          break
        }
        case 'k': {
          const va = sa?.type === 'pitching' ? (sa.strikeouts ?? 0) : -1
          const vb = sb?.type === 'pitching' ? (sb.strikeouts ?? 0) : -1
          cmp = va - vb
          break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sortKey, sortDir])

  const POSITIONS = ['all', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'IF', 'OF']
  const BT_OPTIONS = ['all', 'R', 'L', 'S']

  const filterPlayers = useCallback((list: RosterPlayer[]): RosterPlayer[] => {
    let result = list
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q)
      )
    }
    if (positionFilter !== 'all') {
      result = result.filter((p) => {
        if (positionFilter === 'IF') return ['1B', '2B', '3B', 'SS'].includes(p.position)
        if (positionFilter === 'OF') return ['LF', 'CF', 'RF'].includes(p.position)
        return p.position === positionFilter
      })
    }
    if (btFilter !== 'all') {
      result = result.filter((p) => p.bats === btFilter || p.throws === btFilter)
    }
    return result
  }, [search, positionFilter, btFilter])

  const activePlayers = useMemo(
    () => sortPlayers(filterPlayers(roster.filter((p) => p.status === 'active'))),
    [roster, sortPlayers, filterPlayers]
  )
  const ilPlayers = useMemo(
    () => sortPlayers(filterPlayers(roster.filter((p) => p.status.startsWith('il')))),
    [roster, sortPlayers, filterPlayers]
  )
  const otherPlayers = useMemo(
    () => sortPlayers(filterPlayers(roster.filter((p) => p.status !== 'active' && !p.status.startsWith('il')))),
    [roster, sortPlayers, filterPlayers]
  )

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const SortButton = ({ value, label }: { value: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 text-xs gap-0.5 px-2 ${sortKey === value ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
      onClick={() => toggleSort(value)}
    >
      {label}
      {sortKey === value && (
        <span className="text-[10px] ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>
      )}
    </Button>
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium mr-auto">Roster</CardTitle>
          <div className="flex items-center gap-1">
            {sortOptions.map((o) => (
              <SortButton key={o.value} value={o.value} label={o.label} />
            ))}
          </div>
          <Select value={teamId} onValueChange={(v) => v && setTeamId(v)}>
            <SelectTrigger className="w-[200px] h-8 text-xs" aria-label="Select team">
              <SelectValue placeholder="Pick a team" />
            </SelectTrigger>
            <SelectContent>
              {teamOptions.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <LogoImage src={TEAM_LOGOS[MLB_TEAMS[Number(t.id)]?.abbreviation]} alt={MLB_TEAMS[Number(t.id)]?.abbreviation || ''} className="h-3.5 w-3.5" />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={positionFilter} onValueChange={(v) => v && setPositionFilter(v)}>
            <SelectTrigger className="w-20 h-8 text-xs" aria-label="Filter by position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{p === 'all' ? 'Pos' : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={btFilter} onValueChange={(v) => v && setBtFilter(v)}>
            <SelectTrigger className="w-14 h-8 text-xs" aria-label="Filter by bats/throws">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BT_OPTIONS.map((b) => (
                <SelectItem key={b} value={b} className="text-xs">{b === 'all' ? 'B/T' : b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-28">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              aria-label="Filter roster players"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportCSV} disabled={roster.length === 0}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load roster</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadRoster}>Retry</Button>
          </div>
        ) : roster.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No roster data available</div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="p-2">
              <button
                onClick={() => setActiveExpanded(!activeExpanded)}
                aria-expanded={activeExpanded}
                aria-controls="roster-active-players"
                className="text-xs font-medium text-muted-foreground px-3 py-1 hover:text-foreground select-none flex items-center gap-1 w-full text-left"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${activeExpanded ? '' : '-rotate-90'}`} aria-hidden="true" />
                Active ({activePlayers.length})
              </button>
              <div id="roster-active-players">{activeExpanded && <RosterTable players={activePlayers} />}</div>
              {ilPlayers.length > 0 && (
                <>
                  <button
                    onClick={() => setIlExpanded(!ilExpanded)}
                    aria-expanded={ilExpanded}
                    aria-controls="roster-il-players"
                    className="text-xs font-medium text-muted-foreground px-3 py-2 mt-2 hover:text-foreground select-none flex items-center gap-1 w-full text-left"
                  >
                    <ChevronDown className={`h-3 w-3 transition-transform ${ilExpanded ? '' : '-rotate-90'}`} aria-hidden="true" />
                    Injured List ({ilPlayers.length})
                  </button>
                  <div id="roster-il-players">{ilExpanded && <RosterTable players={ilPlayers} />}</div>
                </>
              )}
              {otherPlayers.length > 0 && (
                <>
                  <button
                    onClick={() => setOtherExpanded(!otherExpanded)}
                    aria-expanded={otherExpanded}
                    aria-controls="roster-other-players"
                    className="text-xs font-medium text-muted-foreground px-3 py-2 mt-2 hover:text-foreground select-none flex items-center gap-1 w-full text-left"
                  >
                    <ChevronDown className={`h-3 w-3 transition-transform ${otherExpanded ? '' : '-rotate-90'}`} aria-hidden="true" />
                    Other ({otherPlayers.length})
                  </button>
                  <div id="roster-other-players">{otherExpanded && <RosterTable players={otherPlayers} />}</div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function RosterTable({ players }: { players: RosterPlayer[] }) {
  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-[11px] py-1">#</TableHead>
          <TableHead className="text-[11px] py-1">Name</TableHead>
          <TableHead className="text-[11px] py-1">Pos</TableHead>
          <TableHead className="text-[11px] py-1 w-12">B/T</TableHead>
          <TableHead className="text-[11px] py-1 w-24">Stats</TableHead>
          <TableHead className="text-[11px] py-1">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((p) => (
          <TableRow key={p.playerId} className="text-xs">
            <TableCell className="py-1.5 text-muted-foreground">{p.jerseyNumber || '-'}</TableCell>
            <TableCell className="py-1.5 font-medium">
              <Link href={`/players/${p.playerId}`} className="hover:underline">
                {p.fullName}
              </Link>
            </TableCell>
            <TableCell className="py-1.5">{p.position}</TableCell>
            <TableCell className="py-1.5 text-muted-foreground font-mono text-[11px]">
              {p.bats && p.throws ? `${p.bats}/${p.throws}` : p.bats || p.throws || '-'}
            </TableCell>
            <TableCell className="py-1.5 text-[11px] text-muted-foreground font-mono">
              {p.seasonStats ? compactStats(p.seasonStats) : '-'}
            </TableCell>
            <TableCell className="py-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[p.status] || 'bg-muted text-muted-foreground'}`}>
                {p.status === 'active' ? 'Active' : p.status.toUpperCase()}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}

function compactStats(stats: BattingStats | PitchingStats): string {
  if (stats.type === 'batting') {
    const parts: string[] = []
    if (stats.avg) parts.push(stats.avg)
    if (stats.hr != null) parts.push(`${stats.hr} HR`)
    if (stats.rbi != null) parts.push(`${stats.rbi} RBI`)
    return parts.slice(0, 2).join(' ') || ''
  }
  const parts: string[] = []
  if (stats.era) parts.push(stats.era)
  if (stats.wins != null && stats.losses != null) parts.push(`${stats.wins}-${stats.losses}`)
  if (stats.strikeouts != null) parts.push(`${stats.strikeouts} K`)
  return parts.slice(0, 2).join(' ') || ''
}
