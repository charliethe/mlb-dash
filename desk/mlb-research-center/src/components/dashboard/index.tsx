'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { MLBGame, Alert, NewsItem, WatchlistItem, DailyLogEntry } from '@/types'
import { fetchTodayGames, fetchTransactions } from '@/lib/mlb/api'
import { fetchMLBNews } from '@/lib/rss/fetcher'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarClock, TrendingUp, Star, ScrollText, MapPin, RefreshCw } from 'lucide-react'
import { TEAM_LOGOS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { GameDetailDialog } from '@/components/game/game-detail-dialog'
import { Skeleton } from '@/components/ui/skeleton'

const WATCHLIST_KEY = 'mlb-watchlist-items'
const ALERTS_KEY = 'mlb-alerts'

function getLocalWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]')
  } catch { return [] }
}

function getLocalAlerts(): Alert[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]')
  } catch { return [] }
}

function getTodayLog(): DailyLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('mlb-daily-log') || '[]')
  } catch { return [] }
}

export function TodaySlate() {
  const [games, setGames] = useState<MLBGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedGame, setSelectedGame] = useState<MLBGame | null>(null)
  const hasLive = games.some((g) => g.status.abstractGameState === 'Live')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadGames()
  }, [])

  useEffect(() => {
    if (!hasLive) return
    const interval = setInterval(() => {
      fetchTodayGames().then((data) => {
        if (data.length > 0) setGames(data)
      }).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [hasLive])

  async function loadGames() {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchTodayGames()
      setGames(data)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const notStarted = games.filter((g) => g.status.abstractGameState === 'Preview')
  const live = games.filter((g) => g.status.abstractGameState === 'Live')
  const final = games.filter((g) => g.status.abstractGameState === 'Final')

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Today&apos;s Slate
          <span className="text-muted-foreground font-normal text-[10px] ml-auto flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden sm:inline">{format(lastUpdated, 'h:mm a')} updated</span>
            )}
            <button
              onClick={loadGames}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/70 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-2">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load games</p>
            <button
              onClick={loadGames}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/70 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : games.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No games scheduled today</div>
        ) : (
          <div className="divide-y divide-border">
            {live.length > 0 && (
              <>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400 bg-green-500/5">
                  Live · {live.length} game{live.length !== 1 ? 's' : ''}
                </div>
                {live.map((game) => <GameRow key={game.gamePk} game={game} onSelect={setSelectedGame} />)}
              </>
            )}
            {notStarted.map((game) => <GameRow key={game.gamePk} game={game} onSelect={setSelectedGame} />)}
            {final.length > 0 && (
              <>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  Final
                </div>
                {final.map((game) => <GameRow key={game.gamePk} game={game} onSelect={setSelectedGame} />)}
              </>
            )}
          </div>
        )}
      </CardContent>
      {selectedGame && (
        <GameDetailDialog
          game={selectedGame}
          open={!!selectedGame}
          onOpenChange={(open) => { if (!open) setSelectedGame(null) }}
        />
      )}
    </Card>
  )
}

function GameRow({ game, onSelect }: { game: MLBGame; onSelect: (g: MLBGame) => void }) {
  const statusColor =
    game.status.abstractGameState === 'Live' ? 'text-green-400' :
    game.status.abstractGameState === 'Final' ? 'text-muted-foreground' :
    'text-amber-400'

  const isFinal = game.status.abstractGameState === 'Final'
  const isLive = game.status.abstractGameState === 'Live'

  const awayLogo = TEAM_LOGOS[game.teams.away.team.abbreviation]
  const homeLogo = TEAM_LOGOS[game.teams.home.team.abbreviation]

  return (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(game); } }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSelect(game)}>
      <div className="w-14 text-center shrink-0">
        <span className={`text-[10px] font-mono font-semibold ${statusColor} leading-tight block`}>
          {isFinal ? 'FINAL' : isLive ? game.status.detailedState || 'LIVE' : format(parseISO(game.gameDate), 'h:mm a')}
        </span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <LogoImage src={awayLogo} alt={`${game.teams.away.team.abbreviation} logo`} className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{game.teams.away.team.name}</span>
          {game.teams.away.leagueRecord && (
            <span className="text-[10px] text-muted-foreground">
              ({game.teams.away.leagueRecord.wins}-{game.teams.away.leagueRecord.losses})
            </span>
          )}
          {(isLive || isFinal) && game.teams.away.score !== undefined && (
            <span className={`font-mono text-sm font-bold ml-auto ${isLive ? 'text-green-400' : ''}`}>
              {game.teams.away.score}
            </span>
          )}
          {game.teams.away.probablePitcher && !isLive && !isFinal && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              {game.teams.away.probablePitcher.throws === 'L' ? 'L' : 'R'} · <Link href={`/players/${game.teams.away.probablePitcher.id}`} className="hover:underline">{game.teams.away.probablePitcher.fullName}</Link> ({game.teams.away.probablePitcher.wins ?? '-'}/{game.teams.away.probablePitcher.losses ?? '-'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LogoImage src={homeLogo} alt={`${game.teams.home.team.abbreviation} logo`} className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{game.teams.home.team.name}</span>
          {game.teams.home.leagueRecord && (
            <span className="text-[10px] text-muted-foreground">
              ({game.teams.home.leagueRecord.wins}-{game.teams.home.leagueRecord.losses})
            </span>
          )}
          {(isLive || isFinal) && game.teams.home.score !== undefined && (
            <span className={`font-mono text-sm font-bold ml-auto ${isLive ? 'text-green-400' : ''}`}>
              {game.teams.home.score}
            </span>
          )}
          {game.teams.home.probablePitcher && !isLive && !isFinal && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              {game.teams.home.probablePitcher.throws === 'L' ? 'L' : 'R'} · <Link href={`/players/${game.teams.home.probablePitcher.id}`} className="hover:underline">{game.teams.home.probablePitcher.fullName}</Link> ({game.teams.home.probablePitcher.wins ?? '-'}/{game.teams.home.probablePitcher.losses ?? '-'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" />
          {game.venue}
        </div>
      </div>
    </div>
  )
}

export function TopUpdates() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadTopNews()
  }, [])

  async function loadTopNews() {
    setLoading(true)
    setError(false)
    try {
      const fetched = await fetchMLBNews()
      setNews(fetched.filter((n) => n.importance !== 'low').slice(0, 10))
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Top Updates
          <span className="text-muted-foreground font-normal text-[10px] ml-auto flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden sm:inline">{format(lastUpdated, 'h:mm a')} updated</span>
            )}
            <button
              onClick={loadTopNews}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/70 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-2 py-1.5 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load updates</p>
            <button
              onClick={loadTopNews}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/70 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : news.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No important updates yet</div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="divide-y divide-border">
              {news.map((item) => (
                <div key={item.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0 ${
                      item.importance === 'high' ? 'border-red-500/30 text-red-400' :
                      item.importance === 'medium' ? 'border-amber-500/30 text-amber-400' :
                      'border-blue-500/30 text-blue-400'
                    }`}>
                      {item.category}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.source} · {item.publishedAt ? format(parseISO(item.publishedAt), 'h:mm a') : ''}
                      </p>
                    </div>
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

export function WatchlistAlerts() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const w = getLocalWatchlist()
      setWatchlist(w)
      const a = getLocalAlerts()
      setAlerts(a.slice(0, 5))
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          Watchlist
          <span className="text-muted-foreground font-normal text-[10px] ml-auto flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden sm:inline">{format(lastUpdated, 'h:mm a')} updated</span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/70 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </span>
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-2 py-1.5 flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">Failed to load watchlist</p>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/70 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Add players to your watchlist to track them here
          </div>
        ) : (
          <div className="divide-y divide-border">
            {watchlist.slice(0, 5).map((item) => (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium"><Link href={`/players/${item.playerId}`} className="hover:underline">{item.playerName}</Link></p>
                  {item.teamAbbreviation && (
                    <p className="text-xs text-muted-foreground">{item.teamAbbreviation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {alerts.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Recent Alerts</p>
            {alerts.map((alert) => (
              <p key={alert.id} className={`text-xs py-0.5 ${
                alert.importance === 'high' ? 'text-red-400' :
                alert.importance === 'medium' ? 'text-amber-400' : 'text-muted-foreground'
              }`}>
                {alert.title}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DailyLogPreview() {
  const [entries, setEntries] = useState<DailyLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState(false)

  const loadLog = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = getTodayLog()
      setEntries(data.slice(-10))
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLog()
  }, [loadLog])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          Daily MLB Log
          <span className="text-muted-foreground font-normal text-[10px] ml-auto flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden sm:inline">{format(lastUpdated, 'h:mm a')} updated</span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2 px-2">
                <Skeleton className="h-3 w-12 shrink-0 mt-0.5" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-400">Failed to load log</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No log entries yet today</div>
        ) : (
          <ScrollArea className="h-[250px]">
            <div className="divide-y divide-border">
              {entries.map((entry) => (
                <div key={entry.id} className="px-4 py-2 text-xs">
                  <span className="text-muted-foreground font-mono">
                    {format(parseISO(entry.createdAt), 'h:mm a')}
                  </span>
                  <span className={`ml-2 ${
                    entry.importance === 'high' ? 'text-red-400' :
                    entry.importance === 'medium' ? 'text-amber-400' :
                    'text-foreground'
                  }`}>
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
