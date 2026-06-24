import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local'
      )
    }
    return null
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  }

  return supabaseInstance
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export async function insertNewsItems(items: import('@/types').NewsItem[]) {
  if (items.length === 0) return { error: null, count: 0 }
  const supabase = getSupabase()
  if (!supabase) return { error: null, count: 0 }
  return safeQuery(async () => {
    const { error, count } = await supabase.from('news_items').upsert(items, { onConflict: 'duplicate_key', ignoreDuplicates: true }) as { error: unknown; count?: number | null }
    return { error, count }
  }, { error: null, count: 0 })
}

export async function insertAlerts(alerts: import('@/types').Alert[]) {
  if (alerts.length === 0) return { error: null, count: 0 }
  const supabase = getSupabase()
  if (!supabase) return { error: null, count: 0 }
  return safeQuery(async () => {
    const { error, count } = await supabase.from('alerts').insert(alerts) as { error: unknown; count?: number | null }
    return { error, count }
  }, { error: null, count: 0 })
}

export async function insertDailyLog(entries: import('@/types').DailyLogEntry[]) {
  if (entries.length === 0) return { error: null, count: 0 }
  const supabase = getSupabase()
  if (!supabase) return { error: null, count: 0 }
  return safeQuery(async () => {
    const { error, count } = await supabase.from('daily_logs').insert(entries) as { error: unknown; count?: number | null }
    return { error, count }
  }, { error: null, count: 0 })
}

export async function upsertGames(games: import('@/types').MLBGame[]) {
  if (games.length === 0) return
  const supabase = getSupabase()
  if (!supabase) return
  return safeQuery(async () => {
    const records = games.map((g) => ({
      game_pk: g.gamePk,
      game_date: g.gameDate.split('T')[0],
      start_time: g.gameDate,
      status: g.status.abstractGameState,
      away_team_id: g.teams.away.team.id,
      away_team_name: g.teams.away.team.name,
      home_team_id: g.teams.home.team.id,
      home_team_name: g.teams.home.team.name,
      away_score: g.teams.away.score ?? null,
      home_score: g.teams.home.score ?? null,
      probable_away_pitcher: g.teams.away.probablePitcher?.fullName || null,
      probable_home_pitcher: g.teams.home.probablePitcher?.fullName || null,
      venue: g.venue,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('games').upsert(records, { onConflict: 'game_pk' }) as { error: unknown }
    if (error) { console.warn('Game upsert failed:', error) }
  }, undefined)
}

export async function getTodayGames(date?: string): Promise<import('@/types').MLBGame[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const gameDate = date || new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.from('games')
      .select('*')
      .eq('game_date', gameDate)
      .order('start_time', { ascending: true }) as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []).map((d: Record<string, unknown>) => ({
      gamePk: d.game_pk as number,
      gameDate: d.start_time as string || d.game_date as string,
      status: { abstractGameState: d.status as string, detailedState: d.status as string, codedGameState: '', statusCode: '', startTimeTBD: false },
      teams: {
        away: {
          team: { id: d.away_team_id as number, name: d.away_team_name as string || '', abbreviation: '' },
          score: d.away_score as number ?? undefined,
          probablePitcher: d.probable_away_pitcher ? { id: 0, fullName: d.probable_away_pitcher as string } : undefined,
        },
        home: {
          team: { id: d.home_team_id as number, name: d.home_team_name as string || '', abbreviation: '' },
          score: d.home_score as number ?? undefined,
          probablePitcher: d.probable_home_pitcher ? { id: 0, fullName: d.probable_home_pitcher as string } : undefined,
        },
      },
      venue: d.venue as string || '',
      doubleHeader: 'N',
      gameType: 'R',
    }))
  }, [])
}

export async function getUnreadAlerts(): Promise<import('@/types').Alert[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const { data, error } = await supabase.from('alerts')
      .select('*')
      .eq('read_status', false)
      .order('created_at', { ascending: false })
      .limit(50) as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []) as unknown as import('@/types').Alert[]
  }, [])
}

export async function getDailyLog(date?: string, endDate?: string): Promise<import('@/types').DailyLogEntry[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const logDate = date || new Date().toISOString().split('T')[0]
    const query = supabase.from('daily_logs').select('*').order('created_at', { ascending: true })
    if (endDate) {
      query.gte('date', logDate).lte('date', endDate)
    } else {
      query.eq('date', logDate)
    }
    const { data, error } = await query as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []) as unknown as import('@/types').DailyLogEntry[]
  }, [])
}

export async function getWatchlist(): Promise<import('@/types').WatchlistItem[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const { data, error } = await supabase.from('watchlist').select('*').order('created_at', { ascending: false }) as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []) as unknown as import('@/types').WatchlistItem[]
  }, [])
}

export async function getRecentNews(limit = 50): Promise<import('@/types').NewsItem[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const { data, error } = await supabase.from('news_items').select('*').order('published_at', { ascending: false }).limit(limit) as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []) as unknown as import('@/types').NewsItem[]
  }, [])
}

export async function getRecentTransactions(limit = 30): Promise<import('@/types').Transaction[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false }).limit(limit) as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []) as unknown as import('@/types').Transaction[]
  }, [])
}

export async function getResearchNotes(): Promise<import('@/types').ResearchNote[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  return safeQuery(async () => {
    const { data, error } = await supabase.from('research_notes').select('*').order('created_at', { ascending: false }) as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) return []
    return (data || []) as unknown as import('@/types').ResearchNote[]
  }, [])
}

export async function insertResearchNote(note: Partial<import('@/types').ResearchNote>): Promise<import('@/types').ResearchNote | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  return safeQuery(async () => {
    const { data, error } = await supabase.from('research_notes').insert({
      title: note.title,
      content: note.content,
      tags: note.tags || [],
      team_ids: note.teamIds || [],
      player_ids: note.playerIds || [],
      source_urls: note.sourceUrls || [],
    }).select().single() as { data: Record<string, unknown> | null; error: unknown }
    if (error) return null
    return data as unknown as import('@/types').ResearchNote
  }, null)
}

export async function deleteResearchNote(id: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  return safeQuery(async () => {
    const { error } = await supabase.from('research_notes').delete().eq('id', id) as { error: unknown }
    return !error
  }, false)
}
