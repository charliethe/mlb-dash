'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes === 1) return '1m ago'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1h ago'
  return `${hours}h ago`
}

interface Props {
  lastUpdated: Date | null
  loading?: boolean
  onRefresh?: () => void
}

export function FreshnessIndicator({ lastUpdated, loading, onRefresh }: Props) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function tick() {
      setLabel(lastUpdated ? timeAgo(lastUpdated) : '')
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [lastUpdated])

  if (!lastUpdated && !loading) return null

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {loading ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Loading…</span>
        </>
      ) : onRefresh ? (
        <>
          <span>Updated {label}</span>
          <button
            onClick={onRefresh}
            className="p-0.5 rounded hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </>
      ) : (
        <span>Updated {label}</span>
      )}
    </div>
  )
}
