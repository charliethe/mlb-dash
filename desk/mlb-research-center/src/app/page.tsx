'use client'

import { useState, useEffect } from 'react'
import { useDashboardWidgets } from '@/hooks/use-dashboard-widgets'

import { TodaySlate, TopUpdates, WatchlistAlerts, DailyLogPreview } from '@/components/dashboard'
import { TopPerformers, UpcomingWeek, RecentTransactionsWidget, StandingsMini, WeatherForecast, InjuryReport } from '@/components/dashboard/widgets'
import { DashboardWidgetSettings } from '@/components/dashboard/widget-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, AlertCircle } from 'lucide-react'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { fetchTodayGames, fetchTransactions } from '@/lib/mlb/api'

export default function DashboardPage() {
  const [gamesCount, setGamesCount] = useState(0)
  const [liveCount, setLiveCount] = useState(0)
  const [txCount, setTxCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { isVisible } = useDashboardWidgets()

  useEffect(() => { document.title = 'Dashboard — MLB Research' }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [games, txs] = await Promise.all([
          fetchTodayGames(),
          fetchTransactions(new Date().toISOString().split('T')[0]),
        ])
        if (!cancelled) setGamesCount(games.length)
        if (!cancelled) setLiveCount(games.filter((g) => g.status.abstractGameState === 'Live').length)
        if (!cancelled) setTxCount(txs.length)
        if (!cancelled) {
          const highImp = txs.filter((tx) => ['traded', 'callUp', 'freeAgentSigning', 'ilPlacement'].includes(tx.type))
          setAlertCount(highImp.length)
        }
        if (!cancelled) setLastUpdated(new Date())
      } catch (err) {
        console.error('Failed to load stats:', err)
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <DashboardWidgetSettings />
          <FreshnessIndicator lastUpdated={lastUpdated} />
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
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

      {isVisible('TodaySlate') && isVisible('WatchlistAlerts') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {isVisible('TodaySlate') && <ErrorBoundary name="TodaySlate"><TodaySlate /></ErrorBoundary>}
          </div>
          <div>
            {isVisible('WatchlistAlerts') && <ErrorBoundary name="WatchlistAlerts"><WatchlistAlerts /></ErrorBoundary>}
          </div>
        </div>
      )}
      {!isVisible('TodaySlate') && isVisible('WatchlistAlerts') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2" />
          <div>
            <ErrorBoundary name="WatchlistAlerts"><WatchlistAlerts /></ErrorBoundary>
          </div>
        </div>
      )}
      {isVisible('TodaySlate') && !isVisible('WatchlistAlerts') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ErrorBoundary name="TodaySlate"><TodaySlate /></ErrorBoundary>
          </div>
        </div>
      )}

      {isVisible('TopUpdates') && isVisible('DailyLogPreview') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isVisible('TopUpdates') && <ErrorBoundary name="TopUpdates"><TopUpdates /></ErrorBoundary>}
          {isVisible('DailyLogPreview') && <ErrorBoundary name="DailyLogPreview"><DailyLogPreview /></ErrorBoundary>}
        </div>
      )}
      {isVisible('TopUpdates') && !isVisible('DailyLogPreview') && (
        <ErrorBoundary name="TopUpdates"><TopUpdates /></ErrorBoundary>
      )}
      {!isVisible('TopUpdates') && isVisible('DailyLogPreview') && (
        <ErrorBoundary name="DailyLogPreview"><DailyLogPreview /></ErrorBoundary>
      )}

      {(isVisible('TopPerformers') || isVisible('StandingsMini') || isVisible('UpcomingWeek')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {isVisible('TopPerformers') && <ErrorBoundary name="TopPerformers"><TopPerformers /></ErrorBoundary>}
          {isVisible('StandingsMini') && <ErrorBoundary name="StandingsMini"><StandingsMini /></ErrorBoundary>}
          {isVisible('UpcomingWeek') && <ErrorBoundary name="UpcomingWeek"><UpcomingWeek /></ErrorBoundary>}
        </div>
      )}

      {(isVisible('WeatherForecast') || isVisible('InjuryReport') || isVisible('RecentTransactionsWidget')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {isVisible('WeatherForecast') && <ErrorBoundary name="WeatherForecast"><WeatherForecast /></ErrorBoundary>}
          {isVisible('InjuryReport') && <ErrorBoundary name="InjuryReport"><InjuryReport /></ErrorBoundary>}
          {isVisible('RecentTransactionsWidget') && <ErrorBoundary name="RecentTransactionsWidget"><RecentTransactionsWidget /></ErrorBoundary>}
        </div>
      )}
      <ScrollToTop />
    </div>
  )
}
