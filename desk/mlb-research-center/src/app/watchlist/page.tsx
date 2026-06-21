'use client'

import { useEffect } from 'react'
import { PlayerWatchlist } from '@/components/watchlist/player-watch-card'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function WatchlistPage() {
  useEffect(() => { document.title = 'Watchlist — MLB Research' }, [])
  return (
    <ErrorBoundary name="Watchlist">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Player Watchlist</h1>
        <p className="text-xs text-muted-foreground">
          Track players you care about — lineup spot, injuries, call-ups, and recent stats
        </p>
        <PlayerWatchlist />
      </div>
    </ErrorBoundary>
  )
}
