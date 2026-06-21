'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { X } from 'lucide-react'

export function DemoModeBanner() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissedBefore = localStorage.getItem('demo-banner-dismissed')
    if (dismissedBefore) { setDismissed(true); return }
    const supabase = getSupabase()
    if (!supabase) setShow(true)
  }, [])

  if (!show || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
      <span>
        <strong>Demo mode</strong> &mdash; no database connected. Notes, alerts, watchlist, and log are unavailable.
        MLB Stats API data is still loaded.
      </span>
      <button
        onClick={() => { setDismissed(true); localStorage.setItem('demo-banner-dismissed', 'true') }}
        className="shrink-0 hover:opacity-70 cursor-pointer"
        aria-label="Dismiss demo mode banner"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
