'use client'

import { useEffect } from 'react'
import { AlertList } from '@/components/alerts/alert-list'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function AlertsPage() {
  useEffect(() => { document.title = 'Alerts — MLB Research' }, [])
  return (
    <ErrorBoundary name="Alerts">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Alerts</h1>
        <p className="text-xs text-muted-foreground">
          High: scratched starters, injuries, trades, call-ups. Medium: lineup posts, roster moves, bullpen concerns
        </p>
        <AlertList />
      </div>
    </ErrorBoundary>
  )
}
