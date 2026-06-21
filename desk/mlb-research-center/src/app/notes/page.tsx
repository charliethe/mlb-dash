'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ResearchNotes } from '@/components/notes/research-notes'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'

function NotesContent() {
  const params = useSearchParams()
  const playerId = params.get('playerId') ? Number(params.get('playerId')) : undefined
  const playerName = params.get('playerName') || undefined
  return <ResearchNotes prefillPlayerId={playerId} prefillPlayerName={playerName} />
}

export default function NotesPage() {
  return (
    <ErrorBoundary name="Notes">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <NotesContent />
      </Suspense>
      <ScrollToTop />
    </ErrorBoundary>
  )
}
