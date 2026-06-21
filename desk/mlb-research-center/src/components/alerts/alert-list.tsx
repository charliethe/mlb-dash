'use client'

import { useState, useEffect } from 'react'
import type { Alert } from '@/types'
import { getSupabase, getUnreadAlerts } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCheck } from 'lucide-react'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Skeleton } from '@/components/ui/skeleton'

const ALERT_TYPE_LABELS: Record<string, string> = {
  pitcherScratched: 'Pitcher Scratched',
  keyPlayerOut: 'Key Player Out',
  injuryUpdate: 'Injury Update',
  ilMove: 'IL Move',
  trade: 'Trade',
  majorCallUp: 'Major Call-Up',
  closerUnavailable: 'Closer Unavailable',
  postponement: 'Postponed',
  weatherDelay: 'Weather Delay',
  lineupPosted: 'Lineup Posted',
  battingOrderChange: 'Batting Order Change',
  rosterMove: 'Roster Move',
  bullpenConcern: 'Bullpen Concern',
  restingStarters: 'Resting Starters',
  minorUpdate: 'Update',
}

export function AlertList() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadAlerts()
  }, [])

  async function loadAlerts() {
    setLoading(true)
    setError(false)
    try {
      const data = await getUnreadAlerts()
      setAlerts(data as Alert[])
    } catch (err) {
      console.error('Failed to load alerts:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function markAllRead() {
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.from('alerts').update({ read_status: true }).eq('read_status', false) as { error: unknown }
    if (error) { console.warn('Failed to mark alerts read:', error); return }
    setAlerts([])
  }

  async function markRead(id: string) {
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.from('alerts').update({ read_status: true }).eq('id', id) as { error: unknown }
    if (error) { console.warn('Failed to mark alert read:', error); return }
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.importance === filter)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Alerts</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'high' | 'medium')} className="w-auto">
              <TabsList className="h-7">
                <TabsTrigger value="all" className="text-[11px] px-2 py-1 h-7">All</TabsTrigger>
                <TabsTrigger value="high" className="text-[11px] px-2 py-1 h-7">High</TabsTrigger>
                <TabsTrigger value="medium" className="text-[11px] px-2 py-1 h-7">Medium</TabsTrigger>
              </TabsList>
            </Tabs>
            {alerts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs gap-1">
                <CheckCheck className="h-3 w-3" /> Mark All Read
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="h-4 w-4 shrink-0 mt-0.5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load alerts</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadAlerts}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No alerts. You&apos;re up to date.</div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border" aria-live="polite" aria-atomic="true">
              {filtered.map((alert) => (
                <div key={alert.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {alert.teamAbbreviation && TEAM_LOGOS[alert.teamAbbreviation] && (
                          <LogoImage src={TEAM_LOGOS[alert.teamAbbreviation]} alt={`${alert.teamAbbreviation} logo`} className="h-4 w-4" />
                        )}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                          alert.importance === 'high' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                          'border-amber-500/30 text-amber-400 bg-amber-500/10'
                        }`}>
                          {alert.importance.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {ALERT_TYPE_LABELS[alert.type] || alert.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      {alert.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.reason}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {alert.teamAbbreviation && (
                          <span className="text-[11px] text-muted-foreground font-medium">{alert.teamAbbreviation}</span>
                        )}
                        {alert.playerName && (
                          <span className="text-[11px] text-muted-foreground">{alert.playerName}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {alert.createdAt ? format(parseISO(alert.createdAt), 'MMM d, h:mm a') : ''}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Mark alert as read" onClick={() => markRead(alert.id)}>
                      <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
