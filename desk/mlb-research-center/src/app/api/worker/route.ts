import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchMLBNews } from '@/lib/rss/fetcher'
import { fetchTodayGames, fetchTransactions } from '@/lib/mlb/api'
import { classifyNewsItem } from '@/lib/alerts/rules'
import type { MLBGame, Transaction, NewsItem } from '@/types'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET() {
  const results: string[] = []

  try {
    const gamesResult = await syncGames()
    results.push(gamesResult)

    const txResult = await syncTransactions()
    results.push(txResult)

    const newsResult = await syncNews()
    results.push(newsResult)

    const alertResult = await generateAlerts()
    results.push(alertResult)

    const logResult = await generateDailyLog()
    results.push(logResult)

    return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[Worker API] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function generateAlerts(): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) return 'Alerts: Supabase not configured'

  type AlertRecord = {
    type: string
    team_id?: number | null
    team_abbreviation?: string | null
    player_id?: number | null
    player_name?: string | null
    title: string
    importance: string
    reason: string
    source_url?: string | null
  }

  const alerts: AlertRecord[] = []
  const dedupKeys: string[] = []

  // Generate alerts from games (postponements / delays)
  const { data: todayGamesDb } = await supabase.from('games').select('*')
    .in('detailed_status', ['Postponed', 'Delayed', 'Suspended']) as { data: Record<string, unknown>[] | null }

  if (todayGamesDb) {
    for (const g of todayGamesDb) {
      dedupKeys.push(`game_${g.game_pk}`)
      alerts.push({
        type: 'postponement',
        importance: 'high',
        team_id: (g.home_team_id as number) ?? null,
        title: `Game ${g.game_pk} — ${String(g.detailed_status || 'Postponed')}`,
        reason: `Game status: ${String(g.detailed_status || 'Postponed')}`,
      })
    }
  }

  // Generate alerts from recent news items
  const { data: newsItems } = await supabase.from('news_items').select('*')
    .order('published_at', { ascending: false })
    .limit(100) as { data: Record<string, unknown>[] | null }

  if (newsItems) {
    for (const item of newsItems) {
      const news = item as unknown as NewsItem
      const classification = classifyNewsItem(news)
      if (classification.importance === 'high' || classification.importance === 'medium') {
        dedupKeys.push(`news_${news.id}`)
        alerts.push({
          type: classification.type || 'injuryUpdate',
          team_id: news.teamId ?? null,
          team_abbreviation: news.teamAbbreviation ?? null,
          title: news.title,
          importance: classification.importance,
          reason: `From news: ${news.category}`,
          source_url: news.url ?? null,
        })
      }
    }
  }

  if (alerts.length === 0) return 'Alerts: none to create'

  // Deduplicate: check for existing alerts with same title
  const titles = alerts.map((a) => a.title)
  const { data: existing } = await supabase.from('alerts').select('title')
    .in('title', titles) as { data: { title: string }[] | null }

  const existingTitles = new Set((existing || []).map((r) => r.title))
  const toInsert = alerts.filter((a, i) => {
    if (existingTitles.has(a.title)) return false
    existingTitles.add(a.title)
    return true
  })

  if (toInsert.length === 0) return 'Alerts: all already exist'

  const { error } = await supabase.from('alerts').insert(toInsert) as { error: { message: string } | null }
  if (error) return `Alerts error: ${error.message}`
  return `Created ${toInsert.length} alerts`
}

async function syncGames(): Promise<string> {
  const games = await fetchTodayGames()
  if (games.length === 0) return 'No games today'

  const records = games.map((g: MLBGame) => ({
    game_pk: g.gamePk,
    game_date: g.gameDate.split('T')[0],
    status: g.status.abstractGameState,
    detailed_status: g.status.detailedState,
    away_team_id: g.teams.away.team.id,
    home_team_id: g.teams.home.team.id,
    away_score: g.teams.away.score || 0,
    home_score: g.teams.home.score || 0,
    venue: g.venue,
    double_header: g.doubleHeader,
    game_type: g.gameType,
    away_probable_pitcher_name: g.teams.away.probablePitcher?.fullName || null,
    home_probable_pitcher_name: g.teams.home.probablePitcher?.fullName || null,
    away_league_record_wins: g.teams.away.leagueRecord?.wins || null,
    away_league_record_losses: g.teams.away.leagueRecord?.losses || null,
    home_league_record_wins: g.teams.home.leagueRecord?.wins || null,
    home_league_record_losses: g.teams.home.leagueRecord?.losses || null,
  }))

  const supabase = getSupabase()
  if (!supabase) return 'Supabase not configured'
  const { error } = await supabase.from('games').upsert(records, { onConflict: 'game_pk' }) as { error: { message: string } | null }
  if (error) return `Games sync error: ${error.message}`
  return `Synced ${games.length} games`
}

async function syncTransactions(): Promise<string> {
  const transactions = await fetchTransactions()
  if (transactions.length === 0) return 'No transactions'

  const records = transactions.map((t: Transaction) => ({
    id: t.id,
    date: t.date.split('T')[0],
    team_id: t.team.id || null,
    player_id: t.player.id || null,
    type: t.type,
    description: t.description,
    duplicate_key: `${t.date}_${t.type}_${t.player.fullName}_${t.team.abbreviation}`,
  }))

  const sup = getSupabase()
  if (!sup) return 'Supabase not configured'
  const { error } = await sup.from('transactions').upsert(records, {
    onConflict: 'duplicate_key',
    ignoreDuplicates: true,
  }) as { error: { message: string } | null }
  if (error) return `Transactions sync error: ${error.message}`
  return `Synced ${transactions.length} transactions`
}

async function syncNews(): Promise<string> {
  const newsItems = await fetchMLBNews()
  if (newsItems.length === 0) return 'No news items'

  const records = newsItems.map((item: NewsItem) => ({
    id: item.id,
    source: item.source,
    title: item.title,
    url: item.url,
    team_id: item.teamId || null,
    team_abbreviation: item.teamAbbreviation || null,
    players_mentioned: item.playersMentioned,
    category: item.category,
    importance: item.importance,
    published_at: item.publishedAt,
    summary: item.summary,
    duplicate_key: item.duplicateKey,
  }))

  const sup2 = getSupabase()
  if (!sup2) return 'Supabase not configured'
  const { error } = await sup2.from('news_items').upsert(records, {
    onConflict: 'duplicate_key',
    ignoreDuplicates: true,
  }) as { error: { message: string } | null }
  if (error) return `News sync error: ${error.message}`
  return `Synced ${newsItems.length} news items`
}

async function generateDailyLog(): Promise<string> {
  try {
    const res = await fetch(new URL('/api/log/generate', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173').toString())
    const data = await res.json()
    if (data.success) return `Daily log: ${data.results?.join(', ') || 'ok'}`
    return `Daily log error: ${data.error}`
  } catch (err) {
    return `Daily log error: ${err instanceof Error ? err.message : 'unknown'}`
  }
}
