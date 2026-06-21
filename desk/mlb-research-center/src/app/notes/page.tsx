'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ResearchNotes } from '@/components/notes/research-notes'

function NotesContent() {
  const params = useSearchParams()
  const playerId = params.get('playerId') ? Number(params.get('playerId')) : undefined
  const playerName = params.get('playerName') || undefined
  return <ResearchNotes prefillPlayerId={playerId} prefillPlayerName={playerName} />
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <NotesContent />
    </Suspense>
  )
}
