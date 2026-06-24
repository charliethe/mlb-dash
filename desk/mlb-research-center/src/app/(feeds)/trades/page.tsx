'use client'

import { useState, useEffect } from 'react'
import { fetchTransactions } from '@/lib/mlb/api'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { Transaction } from '@/types'

interface TradeGroup {
  id: string
  date: string
  description: string
  entries: Transaction[]
}

function groupTrades(transactions: Transaction[]): TradeGroup[] {
  const grouped = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const key = `${t.date}|${t.description}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(t)
  }
  return Array.from(grouped.entries())
    .map(([id, entries]) => ({
      id,
      date: entries[0].date,
      description: entries[0].description,
      entries,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function TradeCard({ group }: { group: TradeGroup }) {
  const teamsInvolved = new Map<string, { id: number; name: string; abbreviation: string; side: 'sent' | 'received' | 'both' }>()
  for (const e of group.entries) {
    if (e.fromTeam && !teamsInvolved.has(e.fromTeam)) {
      teamsInvolved.set(e.fromTeam, { id: 0, name: '', abbreviation: e.fromTeam, side: 'sent' })
    }
    if (e.team.abbreviation && !teamsInvolved.has(e.team.abbreviation)) {
      teamsInvolved.set(e.team.abbreviation, { id: e.team.id, name: e.team.name, abbreviation: e.team.abbreviation, side: 'received' })
    } else if (e.team.abbreviation) {
      const existing = teamsInvolved.get(e.team.abbreviation)!
      existing.side = 'both'
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-2 pt-0.5">
            {Array.from(teamsInvolved.values()).map((t, i) => (
              <div key={t.abbreviation} className="flex items-center gap-1">
                {TEAM_LOGOS[t.abbreviation] && (
                  <LogoImage src={TEAM_LOGOS[t.abbreviation]} alt="" className="h-5 w-5" />
                )}
                <Link href={`/teams/${t.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                  {t.abbreviation}
                </Link>
                {i < teamsInvolved.size - 1 && (
                  <ArrowLeftRight className="h-3 w-3 text-muted-foreground mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 mb-3">{group.description}</p>
        <div className="flex flex-wrap gap-2">
          {group.entries.map((e) => (
            <Link
              key={e.id}
              href={`/players/${e.player.id}`}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 hover:bg-muted transition-colors text-xs"
            >
              <span>{e.player.fullName}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Link>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground mt-2">
          {format(parseISO(group.date), 'MMM d, yyyy')}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TradesPage() {
  useEffect(() => { document.title = 'Trade Tracker — MLB Research' }, [])
  return (
    <ErrorBoundary name="TradeTracker">
      <TradesContent />
    </ErrorBoundary>
  )
}

function TradesContent() {
  const [groups, setGroups] = useState<TradeGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [days, setDays] = useState(60)

  useEffect(() => {
    loadTrades()
  }, [days])

  async function loadTrades() {
    setLoading(true)
    setError(false)
    try {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - days)
      const data = await fetchTransactions(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
      )
      const trades = data.filter((t) => t.type === 'traded')
      setGroups(groupTrades(trades))
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          Trade Tracker
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-xs px-2 py-1 rounded ${
                  days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadTrades} />
        </div>
      </div>

      {loading ? (
        <CardSkeleton count={5} />
      ) : error ? (
        <ErrorState message="Failed to load trade data" onRetry={loadTrades} />
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-xs">
            No trades found in the last {days} days
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <TradeCard key={g.id} group={g} />
          ))}
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
