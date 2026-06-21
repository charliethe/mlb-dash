'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/hooks/use-notifications'
import { getRecentNews } from '@/lib/supabase/client'
import type { WatchlistItem, NewsItem } from '@/types'

const POLL_INTERVAL = 60000
const SEEN_KEY = 'mlb-watchlist-seen'

export function WatchlistAlerter({ watchlist }: { watchlist: WatchlistItem[] }) {
  const { notify } = useNotifications()

  useEffect(() => {
    if (watchlist.length === 0) return

    async function poll() {
      try {
        const news = await getRecentNews(50)
        const watchedNames = watchlist.map((w) => w.playerName?.toLowerCase()).filter(Boolean) as string[]
        const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))

        const matches: NewsItem[] = []
        for (const item of news) {
          if (seen.has(item.id)) continue
          const title = item.title.toLowerCase()
          if (watchedNames.some((name) => title.includes(name))) {
            matches.push(item)
          }
        }

        if (matches.length > 0) {
          const newSeen = [...seen]
          for (const m of matches) {
            if (!newSeen.includes(m.id)) newSeen.push(m.id)
            notify({
              title: `Watchlist: ${watchedNames.find((n) => m.title.toLowerCase().includes(n)) || 'Player'}`,
              description: m.title,
              importance: 'high',
              url: m.url,
            })
          }
          localStorage.setItem(SEEN_KEY, JSON.stringify(newSeen.slice(-500)))
        }
      } catch { console.warn('Watchlist poll failed') }
    }

    const interval = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [watchlist, notify])

  return null
}
