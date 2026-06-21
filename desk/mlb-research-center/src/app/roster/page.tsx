'use client'

import { useEffect } from 'react'
import { RosterView } from '@/components/roster/roster-table'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function RosterPage() {
  useEffect(() => { document.title = 'Roster — MLB Research' }, [])
  return (
    <ErrorBoundary name="Roster">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Roster Tracker</h1>
        <p className="text-xs text-muted-foreground">
          Active rosters, IL placements, call-ups, and transactions — select a team below
        </p>
        <RosterView />
      </div>
    </ErrorBoundary>
  )
}
