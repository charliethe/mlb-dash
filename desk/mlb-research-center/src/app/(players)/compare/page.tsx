'use client'

import { useState, useEffect } from 'react'
import { fetchPlayerInfo, fetchBulkPlayerStats, fetchPlayerCareerStats } from '@/lib/mlb/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { TEAM_LOGOS, playerHeadshotUrl } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Swords, Search, X } from 'lucide-react'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { CsvExportButton } from '@/components/ui/csv-export-button'
import type { MLBPlayer, BattingStats, PitchingStats } from '@/types'

export default function ComparePage() {
  useEffect(() => { document.title = 'Player Comparison — MLB Research' }, [])
  return (
    <ErrorBoundary name="PlayerCompare">
      <CompareInner />
    </ErrorBoundary>
  )
}

function CompareInner() {
  const [playerA, setPlayerA] = useState<MLBPlayer | null>(null)
  const [playerB, setPlayerB] = useState<MLBPlayer | null>(null)
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [resultsA, setResultsA] = useState<any[]>([])
  const [resultsB, setResultsB] = useState<any[]>([])
  const [showSearchA, setShowSearchA] = useState(false)
  const [showSearchB, setShowSearchB] = useState(false)
  const [statsA, setStatsA] = useState<BattingStats | PitchingStats | null>(null)
  const [statsB, setStatsB] = useState<BattingStats | PitchingStats | null>(null)
  const [careerA, setCareerA] = useState<BattingStats | PitchingStats | null>(null)
  const [careerB, setCareerB] = useState<BattingStats | PitchingStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function searchPlayer(query: string, side: 'A' | 'B') {
    if (query.length < 2) {
      if (side === 'A') setResultsA([])
      else setResultsB([])
      return
    }
    try {
      const res = await fetch(`/api/player-search?name=${encodeURIComponent(query)}`)
      const data = await res.json()
      const players = data.players || []
      if (side === 'A') setResultsA(players.slice(0, 10))
      else setResultsB(players.slice(0, 10))
    } catch {
      if (side === 'A') setResultsA([])
      else setResultsB([])
    }
  }

  async function selectPlayer(playerEntry: any, side: 'A' | 'B') {
    setLoading(true)
    try {
      const info = await fetchPlayerInfo(playerEntry.id)
      if (!info) { setLoading(false); return }
      const statsMap = await fetchBulkPlayerStats([playerEntry.id])
      const seasonStats = statsMap.get(playerEntry.id) || null
      const career = await fetchPlayerCareerStats(playerEntry.id)
      if (!career) { setLoading(false); return }

      if (side === 'A') {
        setPlayerA(info)
        setStatsA(seasonStats)
        setCareerA(career.batting ?? career.pitching ?? null)
        setShowSearchA(false)
        setResultsA([])
        setSearchA(info.fullName)
      } else {
        setPlayerB(info)
        setStatsB(seasonStats)
        setCareerB(career.batting ?? career.pitching ?? null)
        setShowSearchB(false)
        setResultsB([])
        setSearchB(info.fullName)
      }
    } catch (err) {
      console.error('Failed to load player', err)
      setError(`Failed to load ${side === 'A' ? searchA || 'player' : searchB || 'player'}. Try again.`)
    } finally {
      setLoading(false)
    }
  }

  function clearPlayer(side: 'A' | 'B') {
    if (side === 'A') {
      setPlayerA(null)
      setStatsA(null)
      setCareerA(null)
      setSearchA('')
    } else {
      setPlayerB(null)
      setStatsB(null)
      setCareerB(null)
      setSearchB('')
    }
  }

  const statRows = getComparisonRows(statsA, statsB)
  const careerRows = getComparisonRows(careerA, careerB)
  const isBatting = statsA?.type === 'batting' || statsB?.type === 'batting'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">Player Comparison</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerSelector
          side="A"
          player={playerA}
          search={searchA}
          setSearch={(v) => { setSearchA(v); searchPlayer(v, 'A') }}
          results={resultsA}
          showSearch={showSearchA}
          setShowSearch={setShowSearchA}
          onSelect={(p) => selectPlayer(p, 'A')}
          onClear={() => clearPlayer('A')}
          loading={loading}
        />
        <PlayerSelector
          side="B"
          player={playerB}
          search={searchB}
          setSearch={(v) => { setSearchB(v); searchPlayer(v, 'B') }}
          results={resultsB}
          showSearch={showSearchB}
          setShowSearch={setShowSearchB}
          onSelect={(p) => selectPlayer(p, 'B')}
          onClear={() => clearPlayer('B')}
          loading={loading}
        />
      </div>

      {playerA && playerB && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{new Date().getFullYear()} Season Stats</CardTitle>
              <CsvExportButton
                filename={`compare_${playerA.fullName.replace(/\s+/g, '_')}_${playerB.fullName.replace(/\s+/g, '_')}_season`}
                headers={['Stat', playerA.fullName, playerB.fullName]}
                rows={statRows.map((r) => [r.label, r.aVal, r.bVal])}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Stat</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground font-medium">{playerA.fullName}</th>
                  <th className="text-center px-2 py-2 text-xs text-muted-foreground font-medium">Δ</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">{playerB.fullName}</th>
                </tr>
              </thead>
              <tbody>
                {statRows.map((row) => (
                  <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs font-medium">{row.label}</td>
                    <td className={`px-4 py-2 text-xs text-right font-mono ${row.aVal !== '-' ? getComparisonClass(row.aNum, row.bNum, isBatting) : ''}`}>
                      {row.aVal}
                    </td>
                    <td className="px-2 py-2 text-xs text-center text-muted-foreground font-mono">
                      {row.aNum !== undefined && row.bNum !== undefined ? (
                        <span className={row.aNum > row.bNum ? 'text-green-400' : row.aNum < row.bNum ? 'text-red-400' : 'text-muted-foreground'}>
                          {row.aNum > row.bNum ? '▲' : row.aNum < row.bNum ? '▼' : '—'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-2 text-xs font-mono ${row.bVal !== '-' ? getComparisonClass(row.bNum, row.aNum, isBatting) : ''}`}>
                      {row.bVal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {statRows.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground text-center">No season stats available</p>
            )}
          </CardContent>
        </Card>
      )}

      {playerA && playerB && careerRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Career Stats</CardTitle>
              <CsvExportButton
                filename={`compare_${playerA.fullName.replace(/\s+/g, '_')}_${playerB.fullName.replace(/\s+/g, '_')}_career`}
                headers={['Stat', playerA.fullName, playerB.fullName]}
                rows={careerRows.map((r) => [r.label, r.aVal, r.bVal])}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Stat</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground font-medium">{playerA.fullName}</th>
                  <th className="text-center px-2 py-2 text-xs text-muted-foreground font-medium">Δ</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">{playerB.fullName}</th>
                </tr>
              </thead>
              <tbody>
                {careerRows.map((row) => (
                  <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs font-medium">{row.label}</td>
                    <td className={`px-4 py-2 text-xs text-right font-mono ${row.aVal !== '-' ? getComparisonClass(row.aNum, row.bNum, isBatting) : ''}`}>
                      {row.aVal}
                    </td>
                    <td className="px-2 py-2 text-xs text-center text-muted-foreground font-mono">
                      {row.aNum !== undefined && row.bNum !== undefined ? (
                        <span className={row.aNum > row.bNum ? 'text-green-400' : row.aNum < row.bNum ? 'text-red-400' : 'text-muted-foreground'}>
                          {row.aNum > row.bNum ? '▲' : row.aNum < row.bNum ? '▼' : '—'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-2 text-xs font-mono ${row.bVal !== '-' ? getComparisonClass(row.bNum, row.aNum, isBatting) : ''}`}>
                      {row.bVal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-center">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setError(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {!playerA || !playerB ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            Search for two players above to compare their stats side by side.
          </CardContent>
        </Card>
      ) : null}

      <ScrollToTop />
    </div>
  )
}

function PlayerSelector({
  side, player, search, setSearch, results, showSearch, setShowSearch, onSelect, onClear, loading,
}: {
  side: string
  player: MLBPlayer | null
  search: string
  setSearch: (v: string) => void
  results: any[]
  showSearch: boolean
  setShowSearch: (v: boolean) => void
  onSelect: (p: any) => void
  onClear: () => void
  loading: boolean
}) {
  function handleInput(v: string) {
    setSearch(v)
    setShowSearch(true)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
          Player {side}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {player ? (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
            <div className="relative w-10 h-10 shrink-0">
              <img
                src={playerHeadshotUrl(player.id, 60)}
                alt={player.fullName}
                className="w-10 h-10 rounded-full object-cover bg-muted"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{player.fullName}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {player.currentTeam && TEAM_LOGOS[player.currentTeam.abbreviation] && (
                  <LogoImage src={TEAM_LOGOS[player.currentTeam.abbreviation]} alt={player.currentTeam.abbreviation} className="h-3 w-3" />
                )}
                <span>{player.primaryPosition}</span>
                <span>· {player.bats}/{player.throws}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="Search player..."
                className="pl-8 h-8 text-sm"
                onFocus={() => search.length >= 2 && setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              />
            </div>
            {showSearch && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                {results.map((p: any) => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    onMouseDown={() => onSelect(p)}
                  >
                    <div className="relative w-6 h-6 shrink-0">
                      <img
                        src={playerHeadshotUrl(p.id, 40)}
                        alt={p.fullName}
                        className="w-6 h-6 rounded-full object-cover bg-muted"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.fullName}</div>
                      <div className="text-[10px] text-muted-foreground">{p.pos} · {p.team || 'FA'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {loading && <Skeleton className="h-10 w-full" />}
      </CardContent>
    </Card>
  )
}

function getComparisonRows(statsA: BattingStats | PitchingStats | null, statsB: BattingStats | PitchingStats | null) {
  if (!statsA && !statsB) return []

  const a = statsA as BattingStats | null
  const b = statsB as BattingStats | null
  const isBatting = a?.type === 'batting' || b?.type === 'batting'

  if (isBatting) {
    const keys: { label: string; key: keyof BattingStats; higherBetter: boolean }[] = [
      { label: 'G', key: 'games', higherBetter: true },
      { label: 'AB', key: 'atBats', higherBetter: true },
      { label: 'R', key: 'runs', higherBetter: true },
      { label: 'H', key: 'hits', higherBetter: true },
      { label: '2B', key: 'doubles', higherBetter: true },
      { label: '3B', key: 'triples', higherBetter: true },
      { label: 'HR', key: 'hr', higherBetter: true },
      { label: 'RBI', key: 'rbi', higherBetter: true },
      { label: 'BB', key: 'walks', higherBetter: true },
      { label: 'K', key: 'strikeouts', higherBetter: false },
      { label: 'SB', key: 'stolenBases', higherBetter: true },
      { label: 'AVG', key: 'avg', higherBetter: true },
      { label: 'OBP', key: 'obp', higherBetter: true },
      { label: 'SLG', key: 'slg', higherBetter: true },
      { label: 'OPS', key: 'ops', higherBetter: true },
    ]
    return keys.map(({ label, key, higherBetter }) => ({
      label,
      aVal: a ? String(a[key] ?? '-') : '-',
      bVal: b ? String(b[key] ?? '-') : '-',
      aNum: parseNumeric(a?.[key]),
      bNum: parseNumeric(b?.[key]),
      higherBetter,
    }))
  }

  const ap = statsA as PitchingStats | null
  const bp = statsB as PitchingStats | null
  const keys: { label: string; key: keyof PitchingStats; higherBetter: boolean }[] = [
    { label: 'G', key: 'games', higherBetter: true },
    { label: 'GS', key: 'gamesStarted', higherBetter: true },
    { label: 'W', key: 'wins', higherBetter: true },
    { label: 'L', key: 'losses', higherBetter: false },
    { label: 'IP', key: 'inningsPitched', higherBetter: true },
    { label: 'ERA', key: 'era', higherBetter: false },
    { label: 'WHIP', key: 'whip', higherBetter: false },
    { label: 'K', key: 'strikeouts', higherBetter: true },
    { label: 'BB', key: 'walks', higherBetter: false },
    { label: 'SV', key: 'saves', higherBetter: true },
    { label: 'HLD', key: 'holds', higherBetter: true },
    { label: 'BS', key: 'blownSaves', higherBetter: false },
  ]
  return keys.map(({ label, key, higherBetter }) => ({
    label,
    aVal: ap ? String(ap[key] ?? '-') : '-',
    bVal: bp ? String(bp[key] ?? '-') : '-',
    aNum: parseNumeric(ap?.[key]),
    bNum: parseNumeric(bp?.[key]),
    higherBetter,
  }))
}

function parseNumeric(val: unknown): number | undefined {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? undefined : n
  }
  return undefined
}

function getComparisonClass(val: number | undefined, other: number | undefined, batting: boolean): string {
  if (val === undefined || other === undefined) return ''
  if (val > other) return batting ? 'text-green-400' : 'text-red-400'
  if (val < other) return batting ? 'text-red-400' : 'text-green-400'
  return ''
}
