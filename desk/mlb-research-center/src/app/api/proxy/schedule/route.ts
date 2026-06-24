import { NextRequest, NextResponse } from 'next/server'

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const sportId = searchParams.get('sportId') || '1'
  const hydrate = searchParams.get('hydrate') || 'probablePitcher,team(leagueRecord),linescore'

  const params = new URLSearchParams({ date, sportId, hydrate })
  for (const [k, v] of searchParams.entries()) {
    if (!['date', 'sportId', 'hydrate'].includes(k)) params.set(k, v)
  }

  const url = `${MLB_API_BASE}/schedule?${params}`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 60 },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
