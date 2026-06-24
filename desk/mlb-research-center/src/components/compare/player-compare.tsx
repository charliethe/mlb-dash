'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, X, Plus, Loader2, Link as LinkIcon } from 'lucide-react'
import { fetchBulkPlayerStats } from '@/lib/mlb/api'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import type { MLBPlayer, BattingStats, PitchingStats } from '@/types'

function normPos(pos: unknown): string {
  if (typeof pos === 'string') return pos
  if (pos && typeof pos === 'object') return String((pos as { name?: string }).name || (pos as { abbreviation?: string }).abbreviation || 'N/A')
  return 'N/A'
}

function normTeam(team: unknown): { id: number; name: string; abbreviation: string } | undefined {
  if (!team || typeof team !== 'object') return undefined
  const t = team as { id?: number; name?: string; abbreviation?: string }
  return { id: t.id ?? 0, name: t.name || '', abbreviation: t.abbreviation || '' }
}

interface ComparePlayer {
  info: MLBPlayer
  stats: BattingStats | PitchingStats | null
}

export function PlayerCompare() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MLBPlayer[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [players, setPlayers] = useState<ComparePlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const initializedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const ids = searchParams.get('players')
    if (ids && !initializedRef.current) {
      initializedRef.current = true
      const parsed = ids.split(',').map(Number).filter(Boolean)
      if (parsed.length === 0) return
      setLoading(true)
      fetchBulkPlayerStats(parsed).then((statsMap) => {
        const infoPromises = parsed.map((id) =>
          fetch(`https://statsapi.mlb.com/api/v1/people/${id}`).then((r) => r.json()).then((d) => d.people?.[0])
        )
        return Promise.all(infoPromises).then((infos) => {
          const loaded: ComparePlayer[] = infos
            .filter((info): info is MLBPlayer => info != null)
            .map((info) => ({
              info: { ...info, primaryPosition: normPos(info.primaryPosition), currentTeam: normTeam(info.currentTeam) },
              stats: statsMap.get(info.id) || null,
            }))
          setPlayers(loaded)
        })
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      initializedRef.current = true
    }
  }, [searchParams])

  useEffect(() => {
    if (!initializedRef.current) return
    const ids = players.map((p) => p.info.id).join(',')
    const params = new URLSearchParams(searchParams.toString())
    if (ids) {
      params.set('players', ids)
    } else {
      params.delete('players')
    }
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [players, router, searchParams])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/player-search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        const people = (data.people || [])
        setResults(people)
        setShowDropdown(people.length > 0)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function addPlayer(raw: MLBPlayer) {
    const p = { ...raw, primaryPosition: normPos(raw.primaryPosition), currentTeam: normTeam(raw.currentTeam) }
    if (players.some((cp) => cp.info.id === p.id)) {
      setQuery('')
      setResults([])
      return
    }
    setLoading(true)
    try {
      const statsMap = await fetchBulkPlayerStats([p.id])
      const stats = statsMap.get(p.id) || null
      setPlayers((prev) => [...prev, { info: p, stats }])
    } catch {
      setPlayers((prev) => [...prev, { info: p, stats: null }])
    } finally {
      setLoading(false)
      setQuery('')
      setResults([])
    }
  }

  function removePlayer(id: number) {
    setPlayers((prev) => prev.filter((p) => p.info.id !== id))
  }

  const isPitcher = (p: ComparePlayer) => p.info.primaryPosition === 'Pitcher'
  const battingRows = ['games', 'avg', 'obp', 'slg', 'ops', 'hr', 'rbi', 'runs', 'hits', 'doubles', 'triples', 'sb', 'walks', 'strikeouts'] as const
  const pitchingRows = ['wins', 'losses', 'era', 'whip', 'games', 'gamesStarted', 'inningsPitched', 'strikeouts', 'walks', 'saves', 'holds'] as const

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Add Players</CardTitle>
          {players.length > 1 && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <LinkIcon className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          )}
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Start typing a player name..."
              aria-label="Search MLB players"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              className="pl-9 h-9 text-sm"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {showDropdown && results.length > 0 && (
            <div ref={dropdownRef} className="mt-2 border border-border rounded-lg divide-y divide-border max-h-60 overflow-auto shadow-lg">
              {results.map((p) => {
                const idx = p.fullName.toLowerCase().indexOf(query.toLowerCase())
                return (
                  <button
                    key={p.id}
                    onClick={() => addPlayer(p)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 text-left cursor-pointer transition-colors"
                  >
                    <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                      {p.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {idx >= 0 ? (
                          <>
                            {p.fullName.slice(0, idx)}
                            <mark className="bg-amber-500/30 text-foreground rounded-sm px-0.5">{p.fullName.slice(idx, idx + query.length)}</mark>
                            {p.fullName.slice(idx + query.length)}
                          </>
                        ) : p.fullName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{normPos(p.primaryPosition)} · {p.currentTeam?.abbreviation || 'FA'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-32 rounded-lg" />}

      {players.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground w-32">Stat</th>
                {players.map((p) => (
                  <th key={p.info.id} className="py-2 px-2 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      {p.info.currentTeam && TEAM_LOGOS[p.info.currentTeam.abbreviation] && (
                        <LogoImage src={TEAM_LOGOS[p.info.currentTeam.abbreviation]} alt={`${p.info.currentTeam.abbreviation} logo`} className="h-4 w-4 shrink-0" />
                      )}
                      <Link href={`/players/${p.info.id}`} className="font-medium hover:underline truncate">
                        {p.info.fullName}
                      </Link>
                      <button aria-label={`Remove ${p.info.fullName} from comparison`} onClick={() => removePlayer(p.info.id)} className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer">
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{normPos(p.info.primaryPosition)}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.some((p) => !isPitcher(p)) && (
                <>
                  <tr className="border-b border-border/50">
                    <td colSpan={players.length + 1} className="py-1.5 px-2 text-[11px] font-medium text-muted-foreground uppercase">
                      Batting
                    </td>
                  </tr>
                  {battingRows.map((row) => (
                    <tr key={row} className="border-b border-border/30">
                      <td className="py-1.5 px-2 text-muted-foreground capitalize">{row === 'avg' ? 'AVG' : row === 'obp' ? 'OBP' : row === 'slg' ? 'SLG' : row === 'ops' ? 'OPS' : row === 'sb' ? 'SB' : row}</td>
                      {players.map((p) => {
                        const s = isPitcher(p) ? null : (p.stats as BattingStats)
                        const val = s ? String(getBattingValue(s, row)) : '-'
                        return <td key={p.info.id} className="py-1.5 px-2 font-mono text-center">{val}</td>
                      })}
                    </tr>
                  ))}
                </>
              )}
              {players.some((p) => isPitcher(p)) && (
                <>
                  <tr className="border-b border-border/50">
                    <td colSpan={players.length + 1} className="py-1.5 px-2 text-[11px] font-medium text-muted-foreground uppercase">
                      Pitching
                    </td>
                  </tr>
                  {pitchingRows.map((row) => (
                    <tr key={row} className="border-b border-border/30">
                      <td className="py-1.5 px-2 text-muted-foreground capitalize">{row === 'era' ? 'ERA' : row === 'whip' ? 'WHIP' : row === 'inningsPitched' ? 'IP' : row}</td>
                      {players.map((p) => {
                        const s = isPitcher(p) ? (p.stats as PitchingStats) : null
                        const val = s ? String(getPitchingValue(s, row)) : '-'
                        return <td key={p.info.id} className="py-1.5 px-2 font-mono text-center">{val}</td>
                      })}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {players.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">Search and add players above to compare their stats side by side</p>
      )}
    </div>
  )
}

function getBattingValue(s: BattingStats, key: string): number | string {
  switch (key) {
    case 'games': return s.games ?? 0
    case 'avg': return s.avg || '-'
    case 'obp': return s.obp || '-'
    case 'slg': return s.slg || '-'
    case 'ops': return s.ops || '-'
    case 'hr': return s.hr ?? 0
    case 'rbi': return s.rbi ?? 0
    case 'runs': return s.runs ?? 0
    case 'hits': return s.hits ?? 0
    case 'doubles': return s.doubles ?? 0
    case 'triples': return s.triples ?? 0
    case 'sb': return s.stolenBases ?? 0
    case 'walks': return s.walks ?? 0
    case 'strikeouts': return s.strikeouts ?? 0
    default: return 0
  }
}

function getPitchingValue(s: PitchingStats, key: string): number | string {
  switch (key) {
    case 'wins': return s.wins ?? 0
    case 'losses': return s.losses ?? 0
    case 'era': return s.era || '-'
    case 'whip': return s.whip || '-'
    case 'games': return s.games ?? 0
    case 'gamesStarted': return s.gamesStarted ?? 0
    case 'inningsPitched': return s.inningsPitched || '-'
    case 'strikeouts': return s.strikeouts ?? 0
    case 'walks': return s.walks ?? 0
    case 'saves': return s.saves ?? 0
    case 'holds': return s.holds ?? 0
    default: return 0
  }
}
