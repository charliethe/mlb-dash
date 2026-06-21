'use client'

import { useEffect } from 'react'
import { LineupCenter } from '@/components/lineup/lineup-card'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function LineupPage() {
  useEffect(() => { document.title = 'Lineup — MLB Research' }, [])
  return (
    <ErrorBoundary name="Lineup">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Lineup Center</h1>
        <p className="text-xs text-muted-foreground">
          Confirmed batting orders, missing starters, catcher rest days, and lineup strength
        </p>
        <LineupCenter />
      </div>
    </ErrorBoundary>
  )
}
