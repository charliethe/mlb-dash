'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MLB_TEAMS, TEAM_LOGOS, TEAM_COLORS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/error-state'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'

const LEAGUES = [
  { name: 'AL East', teams: [110, 111, 141, 139, 147] },
  { name: 'AL Central', teams: [114, 116, 118, 142, 145] },
  { name: 'AL West', teams: [108, 117, 133, 136, 140] },
  { name: 'NL East', teams: [144, 143, 121, 146, 120] },
  { name: 'NL Central', teams: [112, 113, 134, 138, 158] },
  { name: 'NL West', teams: [109, 115, 119, 135, 137] },
]

function TeamsContent() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  const [search, setSearch] = useState(initialSearch)

  const filteredLeagues = LEAGUES.map((league) => ({
    ...league,
    teams: league.teams.filter((id) => {
      const team = MLB_TEAMS[id]
      if (!team) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        team.name.toLowerCase().includes(q) ||
        team.abbreviation.toLowerCase().includes(q) ||
        team.division.toLowerCase().includes(q) ||
        team.league.toLowerCase().includes(q)
      )
    }),
  })).filter((l) => l.teams.length > 0)

  return (
    <ErrorBoundary name="Teams">
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold tracking-tight">Teams</h1>
        <div className="relative w-full max-w-48 sm:w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredLeagues.map((league) => (
          <div key={league.name}>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {league.name}
            </h2>
            <div className="space-y-2">
              {league.teams.map((id) => {
                const team = MLB_TEAMS[id]
                if (!team) return null
                return (
                    <Link key={id} href={`/teams/${id}`}>
                      <Card className="hover:bg-muted/30 transition-colors cursor-pointer" style={TEAM_COLORS[team.abbreviation] ? { borderLeft: `3px solid ${TEAM_COLORS[team.abbreviation]}80` } : undefined}>
                        <CardContent className="p-3 flex items-center gap-3">
                        <LogoImage src={TEAM_LOGOS[team.abbreviation]} alt={team.abbreviation} className="h-8 w-8" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{team.name}</p>
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                              team.league === 'AL' ? 'text-blue-400 border-blue-500/30' : 'text-rose-400 border-rose-500/30'
                            }`}>
                              {team.league}
                            </Badge>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              {team.division}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{team.abbreviation} · {team.division}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
      <ScrollToTop />
    </ErrorBoundary>
  )
}

export default function TeamsPage() {
  useEffect(() => { document.title = 'Teams — MLB Research' }, [])
  return (
    <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"><CardSkeleton count={10} /></div>}>
      <TeamsContent />
    </Suspense>
  )
}
