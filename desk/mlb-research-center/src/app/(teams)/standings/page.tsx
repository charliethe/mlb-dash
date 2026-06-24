import { Suspense } from 'react'
import { CardSkeleton } from '@/components/ui/error-state'
import { fetchStandings } from '@/lib/mlb/api'
import StandingsClient from './client'

export default async function StandingsPage() {
  let initialData = undefined
  try {
    initialData = await fetchStandings()
  } catch {}

  return (
    <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"><CardSkeleton count={6} /></div>}>
      <StandingsClient initialData={initialData} />
    </Suspense>
  )
}
