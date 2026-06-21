import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }
    const today = new Date().toISOString().split('T')[0]

    const url = `${MLB_API_BASE}/schedule?sportId=1&hydrate=probablePitcher,team,venue&date=${today}`
    const res = await fetch(url)

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `MLB API returned ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const games = data.dates?.[0]?.games ?? []

    if (games.length === 0) {
      return NextResponse.json({ success: true, count: 0, games: [] })
    }

    const records = games.map((g: Record<string, unknown>) => {
      const gameDate = (g.gameDate as string)?.split('T')[0] || today
      const startTime = (g.gameDate as string) || null
      const status = (g.status as Record<string, unknown>)?.abstractGameState as string || 'Preview'
      const awayTeam = (g.teams as Record<string, unknown>)?.away as Record<string, unknown> || {}
      const homeTeam = (g.teams as Record<string, unknown>)?.home as Record<string, unknown> || {}
      const awayTeamData = (awayTeam.team as Record<string, unknown>) || {}
      const homeTeamData = (homeTeam.team as Record<string, unknown>) || {}
      const venue = (g.venue as Record<string, unknown>)?.name as string || ''

      return {
        mlb_game_pk: g.gamePk as number,
        game_date: gameDate,
        start_time: startTime,
        status: status,
        away_team_id: awayTeamData.id as number || null,
        away_team_name: awayTeamData.name as string || '',
        home_team_id: homeTeamData.id as number || null,
        home_team_name: homeTeamData.name as string || '',
        away_score: (awayTeam.score as number) ?? null,
        home_score: (homeTeam.score as number) ?? null,
        probable_away_pitcher: (awayTeam.probablePitcher as Record<string, unknown>)?.fullName as string || null,
        probable_home_pitcher: (homeTeam.probablePitcher as Record<string, unknown>)?.fullName as string || null,
        venue: venue,
        updated_at: new Date().toISOString(),
      }
    })

    const { error } = await supabase
      .from('games')
      .upsert(records, { onConflict: 'mlb_game_pk' })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: records.length,
      games: records,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
