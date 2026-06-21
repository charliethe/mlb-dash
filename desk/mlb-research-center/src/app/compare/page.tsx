'use client'

import { useState, useEffect, Suspense } from 'react'
import { PlayerCompare } from '@/components/compare/player-compare'
import { TeamCompare } from '@/components/compare/team-compare'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function ComparePage() {
  useEffect(() => { document.title = 'Compare — MLB Research' }, [])
  const [mode, setMode] = useState<'players' | 'teams'>('players')

  return (
    <ErrorBoundary name="Compare">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Compare</h1>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setMode('players')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              mode === 'players' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Players
          </button>
          <button
            onClick={() => setMode('teams')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              mode === 'teams' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Teams
          </button>
        </div>
      </div>

      {mode === 'players' ? (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <PlayerCompare />
        </Suspense>
      ) : <TeamCompare />}
    </div>
    </ErrorBoundary>
  )
}
