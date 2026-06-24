import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchTodayGames, fetchTransactions } from '@/lib/mlb/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function dateKey(date?: Date): string {
  return (date || new Date()).toISOString().split('T')[0]
}

async function getExistingEntries(date: string): Promise<Set<string>> {
  const supabase = getSupabase()
  if (!supabase) return new Set()
  const { data } = await supabase.from('daily_logs').select('text').eq('date', date) as { data: { text: string }[] | null }
  return new Set((data || []).map((d: { text: string }) => d.text))
}

export async function GET() {
  const today = dateKey()
  const results: string[] = []
  const allEntries: { date: string; category: string; text: string; importance: string; source_url?: string }[] = []

  try {
    const existing = await getExistingEntries(today)

    // 1. Game results
    const games = await fetchTodayGames()
    for (const game of games) {
      if (game.status.abstractGameState === 'Final') {
        const awayName = game.teams.away.team.name
        const homeName = game.teams.home.team.name
        const awayScore = game.teams.away.score ?? 0
        const homeScore = game.teams.home.score ?? 0
        const text = `Final: ${awayName} ${awayScore}, ${homeName} ${homeScore}`
        if (!existing.has(text)) {
          allEntries.push({
            date: today,
            category: 'game',
            text,
            importance: 'medium',
            source_url: undefined,
          })
        }
      } else if (game.status.abstractGameState === 'Live') {
        const text = `⚡ Live: ${game.teams.away.team.name} ${game.teams.away.score ?? 0} - ${game.teams.home.team.name} ${game.teams.home.score ?? 0} (${game.status.detailedState})`
        if (!existing.has(text)) {
          allEntries.push({
            date: today,
            category: 'game',
            text,
            importance: 'high',
            source_url: undefined,
          })
        }
      }
    }
    results.push(`Games: ${games.length} total, ${allEntries.filter(e => e.category === 'game').length} new log entries`)

    // 2. Probable pitchers → Preview entries
    for (const game of games) {
      if (game.status.abstractGameState !== 'Preview') continue
      const away = game.teams.away.probablePitcher?.fullName
      const home = game.teams.home.probablePitcher?.fullName
      if (away || home) {
        const parts = [`Upcoming: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`]
        if (away) parts.push(`${game.teams.away.team.abbreviation}: ${away}`)
        if (home) parts.push(`${game.teams.home.team.abbreviation}: ${home}`)
        parts.push(game.venue)
        const text = parts.join(' — ')
        if (!existing.has(text)) {
          allEntries.push({
            date: today,
            category: 'game',
            text,
            importance: 'low',
            source_url: undefined,
          })
        }
      }
    }

    // 3. Transactions
    const transactions = await fetchTransactions()
    for (const tx of transactions) {
      const text = `${tx.team.name}: ${tx.description || `${tx.type} — ${tx.player.fullName}`}`
      if (!existing.has(text)) {
        allEntries.push({
          date: today,
          category: 'transaction',
          text,
          importance: tx.type === 'released' || tx.type === 'dfa' ? 'high' : 'medium',
          source_url: undefined,
        })
      }
    }
    results.push(`Transactions: ${transactions.length} total, ${allEntries.filter(e => e.category === 'transaction').length} new log entries`)

    // Insert all new entries
    if (allEntries.length > 0) {
      const supabase = getSupabase()
      if (!supabase) return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 })
      const { error } = await supabase.from('daily_logs').insert(allEntries) as { error: { message: string } | null }
      if (error) results.push(`Insert error: ${error.message}`)
      else results.push(`Inserted ${allEntries.length} daily log entries`)
    } else {
      results.push('No new entries to insert')
    }

    return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
