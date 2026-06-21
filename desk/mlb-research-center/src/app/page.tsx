'use client'

import { useState, useEffect } from 'react'


import { TodaySlate, TopUpdates, WatchlistAlerts, DailyLogPreview } from '@/components/dashboard'
import { TopPerformers, UpcomingWeek, RecentTransactionsWidget, StandingsMini, WeatherForecast, InjuryReport } from '@/components/dashboard/widgets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { getTodayGames, getUnreadAlerts } from '@/lib/supabase/client'
import { fetchTodayGames, fetchTransactions } from '@/lib/mlb/api'
import { upsertGames } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [gamesCount, setGamesCount] = useState(0)
  const [liveCount, setLiveCount] = useState(0)
  const [txCount, setTxCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => { document.title = 'Dashboard — MLB Research' }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [alerts] = await Promise.all([getUnreadAlerts()])
        if (!cancelled) setAlertCount(alerts.length)

        let games = await getTodayGames()
        if (games.length === 0) {
          games = await fetchTodayGames()
          if (games.length > 0) await upsertGames(games)
        }
        if (!cancelled) setGamesCount(games.length)
        if (!cancelled) setLiveCount(games.filter((g) => g.status.abstractGameState === 'Live').length)
      } catch (err) {
        console.error('Failed to load stats:', err)
        if (!cancelled) setError(true)
      }

      try {
        const txs = await fetchTransactions(new Date().toISOString().split('T')[0])
        if (!cancelled) setTxCount(txs.length)
      } catch { /* transactions fetch is optional */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Quick Stats
                        {error && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 ml-auto cursor-help" />
                  }
                />
                <TooltipContent side="left">
                  <p className="text-xs">Some stats failed to load</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Games Today', value: gamesCount },
              { label: 'In Progress', value: liveCount },
              { label: 'Transactions', value: txCount },
              { label: 'Unread Alerts', value: alertCount },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ErrorBoundary name="TodaySlate"><TodaySlate /></ErrorBoundary>
        </div>
        <div>
          <ErrorBoundary name="WatchlistAlerts"><WatchlistAlerts /></ErrorBoundary>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary name="TopUpdates"><TopUpdates /></ErrorBoundary>
        <ErrorBoundary name="DailyLogPreview"><DailyLogPreview /></ErrorBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ErrorBoundary name="TopPerformers"><TopPerformers /></ErrorBoundary>
        <ErrorBoundary name="StandingsMini"><StandingsMini /></ErrorBoundary>
        <ErrorBoundary name="UpcomingWeek"><UpcomingWeek /></ErrorBoundary>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ErrorBoundary name="WeatherForecast"><WeatherForecast /></ErrorBoundary>
        <ErrorBoundary name="InjuryReport"><InjuryReport /></ErrorBoundary>
        <ErrorBoundary name="RecentTransactionsWidget"><RecentTransactionsWidget /></ErrorBoundary>
      </div>
    </div>
  )
}
