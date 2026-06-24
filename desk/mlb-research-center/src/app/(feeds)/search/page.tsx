'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Loader2, ArrowRight } from 'lucide-react'
import { MLB_TEAMS, TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import Link from 'next/link'

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  const [input, setInput] = useState(query)
  const [searching, setSearching] = useState(false)
  const [players, setPlayers] = useState<{ id: number; fullName: string; pos: string; team: string }[]>([])
  const [teams, setTeams] = useState<{ id: number; name: string; abbr: string; league: string; division: string }[]>([])

  useEffect(() => {
    if (!query) { setPlayers([]); setTeams([]); return }
    setSearching(true)
    const q = query.toLowerCase()

    const teamResults = Object.entries(MLB_TEAMS)
      .filter(([, t]) => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q))
      .map(([id, t]) => ({ id: Number(id), name: t.name, abbr: t.abbreviation, league: t.league, division: t.division }))
    setTeams(teamResults)

    fetch(`/api/player-search?q=${encodeURIComponent(query)}`)
      .then((r) => r.ok ? r.json() : { players: [] })
      .then((data) => {
        const people = (data.players || []).slice(0, 20).map((p: { id: number; fullName: string; pos: string; team: string }) => ({
          id: p.id,
          fullName: p.fullName,
          pos: p.pos || '?',
          team: p.team || 'FA',
        }))
        setPlayers(people)
      })
      .catch(() => setPlayers([]))
      .finally(() => setSearching(false))
  }, [query])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input.trim()) router.push(`/search?q=${encodeURIComponent(input.trim())}`)
  }

  return (
    <ErrorBoundary name="Search">
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold tracking-tight">Search</h1>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search players, teams..."
          className="pl-9 h-10"
          aria-label="Search query"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </form>

      {!query && <p className="text-sm text-muted-foreground text-center py-8">Enter a search term to find players and teams</p>}

      {query && !searching && teams.length === 0 && players.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No results for &ldquo;{query}&rdquo;</p>
      )}

      {teams.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">Teams ({teams.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {teams.map((t) => (
              <Link key={t.id} href={`/teams/${t.id}`} className="block">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <LogoImage src={TEAM_LOGOS[t.abbr]} alt={t.abbr} className="h-6 w-6 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.abbr} — {t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.league} {t.division}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2 text-muted-foreground">Players ({players.length})</h2>
          <div className="space-y-1">
            {players.map((p) => (
              <Link key={p.id} href={`/players/${p.id}`} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">{p.fullName.charAt(0)}</div>
                <span className="font-medium">{p.fullName}</span>
                <span className="text-muted-foreground text-xs">{p.pos} · {p.team}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
      <ScrollToTop />
    </ErrorBoundary>
  )
}

export default function SearchPage() {
  useEffect(() => { document.title = 'Search — MLB Research' }, [])
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-10" /><Skeleton className="h-32" /></div>}>
      <SearchContent />
    </Suspense>
  )
}
