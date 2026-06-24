import { NextRequest, NextResponse } from 'next/server'

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId') || '103,104'
  const season = searchParams.get('season') || String(new Date().getFullYear())
  const date = searchParams.get('date')

  const params = new URLSearchParams({ leagueId, season })
  if (date) params.set('date', date)

  const url = `${MLB_API_BASE}/standings?${params}`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 180 },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
