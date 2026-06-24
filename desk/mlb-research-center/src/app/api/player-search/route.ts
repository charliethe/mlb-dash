import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

let cachedPlayers: Record<string, unknown>[] = []
let lastFetch = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || searchParams.get('name') || '').trim().toLowerCase()

  if (!q || q.length < 2) return NextResponse.json({ people: [] })

  const now = Date.now()
  if (cachedPlayers.length === 0 || now - lastFetch > 300_000) {
    try {
      const season = new Date().getFullYear()
      const res = await fetch(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 },
      })
      if (res.ok) {
        const data = await res.json()
        cachedPlayers = data.people || []
        lastFetch = now
      }
    } catch {
      // use stale cache
    }
  }

  const filtered = cachedPlayers.filter((p) => {
    const name = ((p as Record<string, unknown>).fullName as string || '').toLowerCase()
    return name.includes(q)
  }).slice(0, 15).map((p: Record<string, unknown>) => ({
    id: Number(p.id),
    fullName: String(p.fullName || ''),
    name: String(p.fullName || ''),
    pos: String((p.primaryPosition as Record<string, unknown>)?.abbreviation || ''),
    team: String((p.currentTeam as Record<string, unknown>)?.abbreviation || ''),
  }))

  return NextResponse.json({ players: filtered })
}
