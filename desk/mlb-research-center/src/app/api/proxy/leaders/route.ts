import { NextRequest, NextResponse } from 'next/server'

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const params = new URLSearchParams()
  for (const [k, v] of searchParams.entries()) {
    params.set(k, v)
  }

  const url = `${MLB_API_BASE}/stats/leaders?${params}`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
