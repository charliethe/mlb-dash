'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchTransactions } from '@/lib/mlb/api'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react'
import type { Transaction, TransactionType } from '@/types'
import { MLB_TEAMS } from '@/lib/mlb/constants'
import { ScrollToTop } from '@/components/ui/scroll-to-top'

const TRANSACTION_TYPES: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Call-Up', value: 'callUp' },
  { label: 'Optioned', value: 'optioned' },
  { label: 'DFA', value: 'dfa' },
  { label: 'Trade', value: 'traded' },
  { label: 'Released', value: 'released' },
  { label: 'Signed', value: 'signed' },
  { label: 'IL Activation', value: 'ilActivation' },
  { label: 'IL Placement', value: 'ilPlacement' },
  { label: 'Waiver Claim', value: 'waiverClaim' },
  { label: 'FA Signing', value: 'freeAgentSigning' },
]

const TYPE_COLORS: Record<string, string> = {
  callUp: 'text-green-400 border-green-500/30',
  optioned: 'text-amber-400 border-amber-500/30',
  dfa: 'text-red-400 border-red-500/30',
  traded: 'text-blue-400 border-blue-500/30',
  released: 'text-red-400 border-red-500/30',
  signed: 'text-green-400 border-green-500/30',
  ilActivation: 'text-teal-400 border-teal-500/30',
  ilPlacement: 'text-red-400 border-red-500/30',
  waiverClaim: 'text-purple-400 border-purple-500/30',
  freeAgentSigning: 'text-green-400 border-green-500/30',
}

export default function TransactionsPage() {
  useEffect(() => { document.title = 'Transactions — MLB Research' }, [])
  const today = new Date().toISOString().split('T')[0]
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [teamFilter, setTeamFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all')

  useEffect(() => { loadTransactions() }, [startDate, endDate])

  async function loadTransactions() {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchTransactions(startDate, endDate)
      setTransactions(data.toReversed())
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (teamFilter !== 'all' && t.team.abbreviation !== teamFilter) return false
    return true
  })

  const uniqueTeams = [...new Set(transactions.map((t) => t.team.abbreviation).filter(Boolean))].sort()
  const teamOptions = uniqueTeams
    .map((abbr) => ({
      abbr,
      name: Object.values(MLB_TEAMS).find((team) => team.abbreviation === abbr)?.name || abbr,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Transactions</h1>
        <div className="flex items-center gap-1.5">
          <DatePicker value={startDate} onChange={setStartDate} label="Start date" />
          <span className="text-xs text-muted-foreground">–</span>
          <DatePicker value={endDate} onChange={setEndDate} label="End date" />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadTransactions} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType | 'all')}>
          <SelectTrigger className="h-7 text-xs w-[130px]" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {teamOptions.length > 0 && (
          <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v || 'all')}>
            <SelectTrigger className="h-7 text-xs w-[130px]" aria-label="Filter by team">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All teams</SelectItem>
              {teamOptions.map((t) => (
                <SelectItem key={t.abbr} value={t.abbr} className="text-xs">{t.abbr} — {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} transactions</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-3 py-2">
                  <Skeleton className="h-3 w-14 shrink-0 mt-1" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-center">
              <p className="text-muted-foreground mb-2">Failed to load transactions</p>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadTransactions}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-sm text-center text-muted-foreground">
              No transactions found{startDate ? ` for ${startDate}${endDate !== startDate ? ` – ${endDate}` : ''}` : ''}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-border">
                {filtered.map((t) => (
                  <div key={t.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[t.type] || 'text-muted-foreground'}`}>
                            {t.type}
                          </Badge>
                          <span className="text-xs font-medium">{t.team.abbreviation}</span>
                          {t.fromTeam && t.toTeam && (
                            <span className="text-xs text-muted-foreground">
                              {t.fromTeam} <ArrowRight className="h-2.5 w-2.5 inline" /> {t.toTeam}
                            </span>
                          )}
                        </div>
                        <Link href={`/players/${t.player.id}`} className="text-sm font-medium hover:underline">
                          {t.player.fullName}
                        </Link>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{format(parseISO(t.date), 'MMM d')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <ScrollToTop />
    </div>
  )
}
