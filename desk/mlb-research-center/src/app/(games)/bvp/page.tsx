'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchBatterVsPitcher, fetchPlayerInfo } from '@/lib/mlb/api'
import { playerHeadshotUrl } from '@/lib/mlb/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, Crosshair } from 'lucide-react'
import type { MLBPlayer, VsSplit } from '@/types'

export default function BvPPage() {
  useEffect(() => { document.title = 'Batter vs Pitcher — MLB Research' }, [])
  return (
    <ErrorBoundary name="BatterVsPitcher">
      <BvPInner />
    </ErrorBoundary>
  )
}

function BvPInner() {
  const [batter, setBatter] = useState<MLBPlayer | null>(null)
  const [pitcher, setPitcher] = useState<MLBPlayer | null>(null)
  const [searchB, setSearchB] = useState('')
  const [searchP, setSearchP] = useState('')
  const [resultsB, setResultsB] = useState<any[]>([])
  const [resultsP, setResultsP] = useState<any[]>([])
  const [showB, setShowB] = useState(false)
  const [showP, setShowP] = useState(false)
  const [stats, setStats] = useState<VsSplit | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function searchPlayer(query: string, side: 'batter' | 'pitcher') {
    if (query.length < 2) {
      if (side === 'batter') setResultsB([])
      else setResultsP([])
      return
    }
    try {
      const res = await fetch(`/api/player-search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      const players = data.players || []
      if (side === 'batter') setResultsB(players.slice(0, 10))
      else setResultsP(players.slice(0, 10))
    } catch {
      if (side === 'batter') setResultsB([])
      else setResultsP([])
    }
  }

  async function selectPlayer(entry: any, side: 'batter' | 'pitcher') {
    try {
      const info = await fetchPlayerInfo(entry.id)
      if (!info) return
      if (side === 'batter') {
        setBatter(info)
        setSearchB(info.fullName)
        setShowB(false)
        setResultsB([])
      } else {
        setPitcher(info)
        setSearchP(info.fullName)
        setShowP(false)
        setResultsP([])
      }
    } catch {
      // silently fail
    }
  }

  const loadMatchup = useCallback(async () => {
    if (!batter || !pitcher) return
    setLoading(true)
    setError(false)
    try {
      const data = await fetchBatterVsPitcher(batter.id, pitcher.id)
      setStats(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [batter, pitcher])

  useEffect(() => {
    if (batter && pitcher) loadMatchup()
  }, [batter, pitcher, loadMatchup])

  const statsRows = stats ? [
    { label: 'AVG', value: stats.avg || '-' },
    { label: 'OBP', value: stats.obp || '-' },
    { label: 'SLG', value: stats.slg || '-' },
    { label: 'OPS', value: stats.ops || '-' },
    { label: 'AB', value: stats.ab ?? '-' },
    { label: 'H', value: stats.hits ?? '-' },
    { label: 'HR', value: stats.homeRuns ?? '-' },
    { label: 'RBI', value: stats.rbi ?? '-' },
    { label: 'BB', value: stats.walks ?? '-' },
    { label: 'K', value: stats.strikeouts ?? '-' },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">Batter vs Pitcher</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerCard
          label="Batter"
          player={batter}
          search={searchB}
          setSearch={(v) => { setSearchB(v); searchPlayer(v, 'batter') }}
          results={resultsB}
          showSearch={showB}
          setShowSearch={setShowB}
          onSelect={(p) => selectPlayer(p, 'batter')}
          onClear={() => { setBatter(null); setStats(null) }}
        />
        <PlayerCard
          label="Pitcher"
          player={pitcher}
          search={searchP}
          setSearch={(v) => { setSearchP(v); searchPlayer(v, 'pitcher') }}
          results={resultsP}
          showSearch={showP}
          setShowSearch={setShowP}
          onSelect={(p) => selectPlayer(p, 'pitcher')}
          onClear={() => { setPitcher(null); setStats(null) }}
        />
      </div>

      {!batter || !pitcher ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground text-center">
            Select a batter and a pitcher to view their career matchup history.
          </CardContent>
        </Card>
      ) : loading ? (
        <CardSkeleton count={6} />
      ) : error ? (
        <Card>
          <CardContent className="p-4 text-sm text-center">
            <p className="text-muted-foreground">Failed to load matchup data.</p>
          </CardContent>
        </Card>
      ) : stats && stats.ab ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img src={playerHeadshotUrl(batter.id, 40)} alt="" className="w-6 h-6 rounded-full object-cover bg-muted" />
                <span className="text-sm font-medium">{batter.fullName}</span>
              </div>
              <span className="text-xs text-muted-foreground">vs</span>
              <div className="flex items-center gap-2">
                <img src={playerHeadshotUrl(pitcher.id, 40)} alt="" className="w-6 h-6 rounded-full object-cover bg-muted" />
                <span className="text-sm font-medium">{pitcher.fullName}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {statsRows.map((row) => (
                <div key={row.label} className="flex flex-col items-center px-3 py-2 rounded-lg bg-muted/30 min-w-[64px]">
                  <span className="text-[11px] text-muted-foreground font-medium">{row.label}</span>
                  <span className="text-lg font-bold tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            No matchup data available between these players.
          </CardContent>
        </Card>
      )}

      <ScrollToTop />
    </div>
  )
}

function PlayerCard({ label, player, search, setSearch, results, showSearch, setShowSearch, onSelect, onClear }: {
  label: string
  player: MLBPlayer | null
  search: string
  setSearch: (v: string) => void
  results: any[]
  showSearch: boolean
  setShowSearch: (v: boolean) => void
  onSelect: (p: any) => void
  onClear: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {player ? (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
            <img
              src={playerHeadshotUrl(player.id, 60)}
              alt={player.fullName}
              className="w-10 h-10 rounded-full object-cover bg-muted"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{player.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {player.primaryPosition} — {player.currentTeam?.abbreviation || ''}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
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
                    <img
                      src={playerHeadshotUrl(p.id, 40)}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover bg-muted"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
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
      </CardContent>
    </Card>
  )
}
