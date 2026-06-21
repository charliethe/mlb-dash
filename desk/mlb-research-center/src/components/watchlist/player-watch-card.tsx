'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { WatchlistItem, MLBPlayer } from '@/types'
import { getSupabase, getWatchlist } from '@/lib/supabase/client'
import { fetchPlayerInfo } from '@/lib/mlb/api'
import { MLB_API_BASE, TEAM_LOGOS } from '@/lib/mlb/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LogoImage } from '@/components/ui/logo-image'
import { Trash2, Search, UserPlus, Loader2, ExternalLink } from 'lucide-react'
import { WatchlistAlerter } from '@/components/watchlist/watchlist-alerter'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface SearchResult {
  id: number
  fullName: string
  team?: string
  teamAbbreviation?: string
  position?: string
}

export function PlayerWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [playerDetails, setPlayerDetails] = useState<Map<number, MLBPlayer>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'team' | 'added'>('added')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const items = await getWatchlist()
        if (cancelled) return
        setWatchlist(items)

        const details = new Map<number, MLBPlayer>()
        for (const item of items) {
          const info = await fetchPlayerInfo(item.playerId)
          if (info) details.set(item.playerId, info)
        }
        if (details.size > 0) {
          if (!cancelled) setPlayerDetails((prev) => new Map([...prev, ...details]))
        }
      } catch (err) {
        console.error('Failed to load watchlist:', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!addOpen) {
      queueMicrotask(() => {
        if (cancelled) return
        setSearchQuery('')
        setSearchResults([])
      })
    }
    return () => { cancelled = true }
  }, [addOpen])

  function handleSearch(value: string) {
    setSearchQuery(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const url = new URL(`${MLB_API_BASE}/people/search`)
        url.searchParams.set('search', value.trim())
        url.searchParams.set('sportId', '1')
        const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
        const data = await res.json()
        const people = (data.people || []) as {
          id: number
          fullName: string
          currentTeam?: { name: string; abbreviation: string }
          primaryPosition?: { abbreviation: string }
        }[]
        setSearchResults(
          people.slice(0, 10).map((p) => ({
            id: p.id,
            fullName: p.fullName,
            team: p.currentTeam?.name,
            teamAbbreviation: p.currentTeam?.abbreviation,
            position: p.primaryPosition?.abbreviation,
          }))
        )
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function addPlayer(playerId: number) {
    setAdding(playerId)
    try {
      const info = await fetchPlayerInfo(playerId)
      if (!info) return

      waitlist: {
        const supabase = getSupabase()
        if (!supabase) break waitlist
        await supabase.from('watchlist').upsert({
          player_id: info.id,
          player_name: info.fullName,
          team_abbreviation: info.currentTeam?.abbreviation || null,
        }, { onConflict: 'player_id' }) as { error: unknown }
      }

      setWatchlist((prev) => {
        if (prev.some((w) => w.playerId === info.id)) return prev
        return [...prev, {
          id: String(info.id),
          playerId: info.id,
          playerName: info.fullName,
          teamAbbreviation: info.currentTeam?.abbreviation || undefined,
          createdAt: new Date().toISOString(),
        }]
      })
      setPlayerDetails((prev) => new Map(prev).set(info.id, info))
      setAddOpen(false)
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      console.error('Failed to add player:', err)
    } finally {
      setAdding(null)
    }
  }

  async function removePlayer(playerId: number) {
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.from('watchlist').delete().eq('player_id', playerId) as { error: unknown }
    if (error) { console.warn('Failed to remove player from watchlist:', error); return }
    setWatchlist((prev) => prev.filter((w) => w.playerId !== playerId))
  }

  const sortedWatchlist = useMemo(() => {
    const list = [...watchlist]
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.playerName.localeCompare(b.playerName))
      case 'team':
        return list.sort((a, b) => (a.teamAbbreviation || '').localeCompare(b.teamAbbreviation || ''))
      case 'added':
      default:
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  }, [watchlist, sortBy])

  return (
    <Card className="h-full">
      <WatchlistAlerter watchlist={watchlist} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Player Watchlist</CardTitle>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" />
              }
            >
              <UserPlus className="h-3 w-3" /> Add Player
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Player to Watchlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search for a player..."
                    aria-label="Search for a player to add"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>

                {searching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="border border-border rounded-md divide-y divide-border max-h-60 overflow-y-auto">
                    {searchResults.map((result) => {
                      const idx = result.fullName.toLowerCase().indexOf(searchQuery.toLowerCase())
                      return (
                      <button
                        key={result.id}
                        onClick={() => addPlayer(result.id)}
                        disabled={adding === result.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {result.teamAbbreviation && TEAM_LOGOS[result.teamAbbreviation] ? (
                          <LogoImage src={TEAM_LOGOS[result.teamAbbreviation]} alt={`${result.teamAbbreviation} logo`} className="h-5 w-5 shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                            {result.fullName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {idx >= 0 ? (
                              <>
                                {result.fullName.slice(0, idx)}
                                <mark className="bg-amber-500/30 text-foreground rounded-sm px-0.5">{result.fullName.slice(idx, idx + searchQuery.length)}</mark>
                                {result.fullName.slice(idx + searchQuery.length)}
                              </>
                            ) : result.fullName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {result.teamAbbreviation && <span>{result.teamAbbreviation}</span>}
                            {result.position && <span>{result.position}</span>}
                          </div>
                        </div>
                        {adding === result.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    )})}
                  </div>
                )}

                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No players found</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {(['added', 'name', 'team'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                sortBy === opt ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt === 'added' ? 'Date Added' : opt === 'name' ? 'Name' : 'Team'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading watchlist...</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-400">Failed to load watchlist</div>
        ) : watchlist.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No players watched yet. Click &quot;Add Player&quot; to search and track players.
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-border">
              {sortedWatchlist.map((item) => {
                const details = playerDetails.get(item.playerId)
                return (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 group">
                    <Link href={`/players/${item.playerId}`} className="min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {item.teamAbbreviation && TEAM_LOGOS[item.teamAbbreviation] && (
                            <LogoImage src={TEAM_LOGOS[item.teamAbbreviation]} alt={`${item.teamAbbreviation} logo`} className="h-4 w-4" />
                          )}
                          <p className="text-sm font-medium group-hover:underline">{item.playerName}</p>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 ml-6">
                          {item.teamAbbreviation && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.teamAbbreviation}
                            </Badge>
                          )}
                          {details?.primaryPosition && (
                            <span className="text-[11px] text-muted-foreground">{details.primaryPosition}</span>
                          )}
                          {details?.bats && (
                            <span className="text-[11px] text-muted-foreground">Bats: {details.bats}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400" aria-label={`Remove ${item.playerName} from watchlist`} onClick={() => removePlayer(item.playerId)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
