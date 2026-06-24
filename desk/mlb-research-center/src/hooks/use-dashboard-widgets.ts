'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'dashboard-widgets'

export const WIDGET_DEFS: { id: string; label: string; section: string }[] = [
  { id: 'TodaySlate', label: "Today's Slate", section: 'main' },
  { id: 'WatchlistAlerts', label: 'Watchlist', section: 'main' },
  { id: 'TopUpdates', label: 'Top Updates', section: 'secondary' },
  { id: 'DailyLogPreview', label: 'Daily Log', section: 'secondary' },
  { id: 'TopPerformers', label: 'Top Performers', section: 'tertiary' },
  { id: 'StandingsMini', label: 'Standings', section: 'tertiary' },
  { id: 'UpcomingWeek', label: 'Upcoming Week', section: 'tertiary' },
  { id: 'WeatherForecast', label: 'Weather', section: 'quaternary' },
  { id: 'InjuryReport', label: 'Injuries', section: 'quaternary' },
  { id: 'RecentTransactionsWidget', label: 'Transactions', section: 'quaternary' },
]

export function useDashboardWidgets() {
  const [visible, setVisible] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(WIDGET_DEFS.map((w) => w.id))
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        return new Set(parsed)
      }
    } catch {}
    return new Set(WIDGET_DEFS.map((w) => w.id))
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible]))
  }, [visible])

  const toggle = useCallback((id: string) => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isVisible = useCallback((id: string) => visible.has(id), [visible])
  const hiddenCount = WIDGET_DEFS.length - visible.size

  return { visible, toggle, isVisible, hiddenCount }
}
