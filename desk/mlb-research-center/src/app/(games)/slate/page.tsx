import { Suspense } from 'react'
import { CardSkeleton } from '@/components/ui/error-state'
import { fetchTodayGames } from '@/lib/mlb/api'
import type { MLBGame } from '@/types'
import SlateClient from './client'

export default async function SlatePage() {
  let initialData: MLBGame[] | undefined
  try {
    const today = new Date().toISOString().split('T')[0]
    initialData = await fetchTodayGames(today)
  } catch {}

  return (
    <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"><CardSkeleton count={6} /></div>}>
      <SlateClient initialData={initialData} />
    </Suspense>
  )
}
