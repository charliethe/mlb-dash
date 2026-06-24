'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wifi, WifiOff, HardDrive, RefreshCw, ExternalLink } from 'lucide-react'

const KNOWN_PAGES = [
  { href: '/', label: 'Dashboard' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/slate', label: 'Slate' },
  { href: '/pitchers', label: 'Starting Pitchers' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/standings', label: 'Standings' },
  { href: '/postseason', label: 'Postseason' },
  { href: '/h2h', label: 'H2H Matrix' },
  { href: '/milestones', label: 'Milestones' },
  { href: '/pythagorean', label: 'Pythagorean' },
  { href: '/season-series', label: 'Season Series' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/injuries', label: 'Injuries' },
  { href: '/news', label: 'News' },
  { href: '/log', label: 'Log' },
  { href: '/roster', label: 'Roster' },
  { href: '/lineup', label: 'Lineup' },
  { href: '/compare', label: 'Compare' },
  { href: '/game-log', label: 'Game Log' },
  { href: '/splits', label: 'Splits' },
  { href: '/team-stats', label: 'Team Stats' },
  { href: '/stats', label: 'Stat Leaders' },
  { href: '/search', label: 'Search' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/notes', label: 'Research Notes' },
  { href: '/settings', label: 'Settings' },
]

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true)
  const [checking, setChecking] = useState(false)
  const [cacheKeys, setCacheKeys] = useState<string[]>([])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    function scanCache() {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('mlb-cache-')) keys.push(key.replace('mlb-cache-', ''))
      }
      setCacheKeys(keys.sort())
    }
    scanCache()
    window.addEventListener('storage', scanCache)
    return () => window.removeEventListener('storage', scanCache)
  }, [])

  async function checkConnection() {
    setChecking(true)
    try {
      await fetch('/api/player-search?q=test', { method: 'HEAD', cache: 'no-store' })
      setIsOnline(true)
      window.location.reload()
    } catch {
      setIsOnline(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        {isOnline ? (
          <Wifi className="h-5 w-5 text-green-400" />
        ) : (
          <WifiOff className="h-5 w-5 text-red-400" />
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {isOnline ? 'Connected' : 'Offline'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isOnline
              ? 'Your browser reports a working internet connection.'
              : 'Your browser reports no internet connection.'
            }
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Cached Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cacheKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cached data found in localStorage.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {cacheKeys.map((key) => (
                <span key={key} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {key.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            Available Pages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isOnline ? (
            <p className="text-xs text-muted-foreground mb-3">
              Pages you have visited while online may be available from the service worker cache.
            </p>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {KNOWN_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="text-xs px-2.5 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors truncate"
              >
                {page.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={checkConnection} disabled={checking}>
          <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Try Again'}
        </Button>
        <Link href="/">
          <Button variant="outline" size="sm" className="text-xs">Home</Button>
        </Link>
      </div>
    </div>
  )
}
