import { MLB_API_BASE } from './constants'
import type { MLBGame, MLBTeam, MLBPlayer, Transaction, TeamGameInfo, PitcherInfo, BattingStats, PitchingStats, GameLogEntry, VsSplit } from '@/types'

export function getCurrentSeason(): string {
  return String(new Date().getFullYear())
}

class MLBApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'MLBApiError'
  }
}

const REQUEST_LOG: number[] = []
const MAX_RPS = 10
const MAX_RETRIES = 3

async function mlFetch<T>(path: string, params?: Record<string, string>, retries = MAX_RETRIES): Promise<T> {
  // Throttle to MAX_RPS requests per second
  const now = Date.now()
  while (REQUEST_LOG.length > 0 && REQUEST_LOG[0] < now - 1000) REQUEST_LOG.shift()
  if (REQUEST_LOG.length >= MAX_RPS) {
    const wait = REQUEST_LOG[0] + 1000 - now
    await new Promise((r) => setTimeout(r, wait + 50))
  }
  REQUEST_LOG.push(Date.now())

  const url = new URL(`${MLB_API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 60 },
  })

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 2
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    return mlFetch<T>(path, params, retries - 1)
  }

  if (!res.ok) {
    throw new MLBApiError(res.status, `MLB API ${res.status}: ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export async function fetchTodayGames(date?: string): Promise<MLBGame[]> {
  const gameDate = date || new Date().toISOString().split('T')[0]
  const data = await mlFetch<{ dates: { games: Record<string, unknown>[] }[] }>('/schedule', {
    date: gameDate,
    sportId: '1',
    hydrate: 'probablePitcher,team(leagueRecord),linescore',
  })

  if (!data.dates?.[0]?.games) return []
  return data.dates[0].games.map((g) => normalizeGame(g))
}

function normalizeGame(game: Record<string, unknown>): MLBGame {
  const g = game as unknown as {
    gamePk: number
    gameDate: string
    status: { abstractGameState: string; codedGameState: string; detailedState: string; statusCode: string; startTimeTBD: boolean }
    teams: {
      away: { team: { id: number; name: string; abbreviation: string }; score?: number; probablePitcher?: { id: number; fullName: string; wins?: number; losses?: number; era?: string; throws?: string }; leagueRecord?: { wins: number; losses: number; pct: string } }
      home: { team: { id: number; name: string; abbreviation: string }; score?: number; probablePitcher?: { id: number; fullName: string; wins?: number; losses?: number; era?: string; throws?: string }; leagueRecord?: { wins: number; losses: number; pct: string } }
    }
    venue?: { name: string }
    doubleHeader?: string
    gameType?: string
  }

  return {
    gamePk: g.gamePk,
    gameDate: g.gameDate,
    status: g.status,
    teams: {
      away: normalizeTeamInfo(g.teams.away),
      home: normalizeTeamInfo(g.teams.home),
    },
    venue: g.venue?.name || 'Unknown',
    doubleHeader: g.doubleHeader || 'N',
    gameType: g.gameType || 'R',
  }
}

function normalizeTeamInfo(t: {
  team: { id: number; name: string; abbreviation: string }
  score?: number
  probablePitcher?: { id: number; fullName: string; wins?: number; losses?: number; era?: string; throws?: string }
  leagueRecord?: { wins: number; losses: number; pct: string }
}): TeamGameInfo {
  return {
    team: { id: t.team.id, name: t.team.name, abbreviation: t.team.abbreviation },
    score: t.score,
    probablePitcher: t.probablePitcher ? normalizePitcher(t.probablePitcher) : undefined,
    leagueRecord: t.leagueRecord,
  }
}

function normalizePitcher(p: {
  id: number
  fullName: string
  wins?: number
  losses?: number
  era?: string
  throws?: string
}): PitcherInfo {
  return {
    id: p.id,
    fullName: p.fullName,
    wins: p.wins,
    losses: p.losses,
    era: p.era,
    throws: p.throws,
  }
}

export async function fetchTeamRoster(teamId: number): Promise<import('@/types').RosterPlayer[]> {
  const data = await mlFetch<{ roster: { person: { id: number; fullName: string; primaryNumber?: string; batSide?: { code: string; description: string }; pitchHand?: { code: string; description: string } }; position: { abbreviation: string }; jerseyNumber?: string; status: { description: string; code: string } }[] }>(`/teams/${teamId}/roster`, {
    rosterType: 'active',
    season: String(new Date().getFullYear()),
    hydrate: 'person',
  })

  if (!data.roster) return []

  return data.roster.map((entry) => ({
    playerId: entry.person.id,
    fullName: entry.person.fullName,
    position: entry.position.abbreviation,
    status: mapStatus(entry.status.code),
    jerseyNumber: entry.jerseyNumber,
    bats: entry.person.batSide?.code === 'R' ? 'R' : entry.person.batSide?.code === 'L' ? 'L' : entry.person.batSide?.code === 'S' ? 'S' : undefined,
    throws: entry.person.pitchHand?.code === 'R' ? 'R' : entry.person.pitchHand?.code === 'L' ? 'L' : undefined,
  }))
}

export async function fetchBulkPlayerStats(playerIds: number[]): Promise<Map<number, BattingStats | PitchingStats>> {
  if (playerIds.length === 0) return new Map()

  const statsMap = new Map<number, BattingStats | PitchingStats>()

  const data = await mlFetch<{ people: Record<string, unknown>[] }>('/people', {
    personIds: playerIds.join(','),
    hydrate: `stats(group=[hitting,pitching,fielding],type=season,season=${getCurrentSeason()})`,
  })

  if (!data.people) return statsMap

  for (const person of data.people) {
    const p = person as unknown as {
      id: number
      primaryPosition: { abbreviation: string }
      stats?: { splits: { stat: Record<string, unknown>; group: { displayName: string } }[] }[]
    }
    const isPitcher = p.primaryPosition?.abbreviation === 'P'
    const statsGroup = p.stats?.[0]
    if (!statsGroup?.splits?.length) continue

    for (const split of statsGroup.splits) {
      if (!split.group) continue
      const g = split.group.displayName

      if (isPitcher && g === 'pitching') {
        const s = split.stat as unknown as {
          wins?: number; losses?: number; era?: string; whip?: string
          gamesPitched?: number; gamesStarted?: number; inningsPitched?: string
          strikeouts?: number; baseOnBalls?: number; saves?: number; holds?: number
        }
        if (s.gamesPitched != null) {
          statsMap.set(p.id, {
            type: 'pitching',
            wins: s.wins,
            losses: s.losses,
            era: s.era,
            whip: s.whip,
            games: s.gamesPitched,
            gamesStarted: s.gamesStarted,
            inningsPitched: s.inningsPitched,
            strikeouts: s.strikeouts,
            walks: s.baseOnBalls,
            saves: s.saves,
            holds: s.holds,
          } as PitchingStats)
        }
      } else if (!isPitcher && g === 'hitting') {
        const s = split.stat as unknown as {
          avg?: string; homeRuns?: number; rbi?: number; ops?: string
          obp?: string; slg?: string; gamesPlayed?: number; atBats?: number
          runs?: number; hits?: number; doubles?: number; triples?: number
          stolenBases?: number; baseOnBalls?: number; strikeouts?: number
        }
        if (s.gamesPlayed != null) {
          statsMap.set(p.id, {
            type: 'batting',
            avg: s.avg,
            hr: s.homeRuns,
            rbi: s.rbi,
            ops: s.ops,
            obp: s.obp,
            slg: s.slg,
            games: s.gamesPlayed,
            atBats: s.atBats,
            runs: s.runs,
            hits: s.hits,
            doubles: s.doubles,
            triples: s.triples,
            stolenBases: s.stolenBases,
            walks: s.baseOnBalls,
            strikeouts: s.strikeouts,
          })
        }
      }
    }
  }

  return statsMap
}

function mapStatus(code: string): import('@/types').RosterStatus {
  const map: Record<string, import('@/types').RosterStatus> = {
    A: 'active',
    IL10: 'il-10',
    IL15: 'il-15',
    IL60: 'il-60',
    IL7: 'il-7',
    MIN: 'minors',
    DFA: 'dfa',
    SUS: 'suspended',
    RES: 'restricted',
    PAT: 'paternity',
    BER: 'bereavement',
  }
  return map[code] || 'active'
}

export async function fetchTransactions(startDate?: string, endDate?: string): Promise<Transaction[]> {
  const today = new Date().toISOString().split('T')[0]
  const data = await mlFetch<{ transactions: Record<string, unknown>[] }>('/transactions', {
    sportId: '1',
    startDate: startDate || today,
    endDate: endDate || today,
  })

  if (!data.transactions) return []

  return data.transactions.map((t: Record<string, unknown>) => ({
    id: String(t.id || ''),
    date: String(t.date || ''),
    team: {
      id: Number((t.team as Record<string, unknown>)?.id || 0),
      name: String((t.team as Record<string, unknown>)?.name || ''),
      abbreviation: String((t.team as Record<string, unknown>)?.abbreviation || ''),
    },
    player: {
      id: Number((t.player as Record<string, unknown>)?.id || 0),
      fullName: String((t.player as Record<string, unknown>)?.fullName || ''),
    },
    type: mapTransactionType(String(t.type || '')),
    description: String(t.description || ''),
  }))
}

function mapTransactionType(type: string): import('@/types').TransactionType {
  const map: Record<string, import('@/types').TransactionType> = {
    callUp: 'callUp',
    optioned: 'optioned',
    dfa: 'dfa',
    traded: 'traded',
    released: 'released',
    signed: 'signed',
    ilActivation: 'ilActivation',
    ilPlacement: 'ilPlacement',
    purchase: 'purchase',
    waiverClaim: 'waiverClaim',
    freeAgentSigning: 'freeAgentSigning',
  }
  return map[type.toLowerCase().replace(/\s+/g, '')] || 'other'
}

export async function fetchTeams(): Promise<MLBTeam[]> {
  const data = await mlFetch<{ teams: Record<string, unknown>[] }>('/teams', {
    sportId: '1',
  })

  return (data.teams || []).map((t: Record<string, unknown>) => ({
    id: Number(t.id),
    name: String(t.name || ''),
    abbreviation: String(t.abbreviation || ''),
    teamName: String(t.teamName || ''),
    locationName: String(t.locationName || ''),
    league: { id: Number((t.league as Record<string, unknown>)?.id || 0), name: String((t.league as Record<string, unknown>)?.name || '') },
    division: { id: Number((t.division as Record<string, unknown>)?.id || 0), name: String((t.division as Record<string, unknown>)?.name || '') },
  }))
}

export async function fetchPlayerInfo(playerId: number): Promise<MLBPlayer | null> {
  try {
    const data = await mlFetch<Record<string, unknown>>(`/people/${playerId}`, {})
    const person = (data.people as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined
    if (!person) return null

    return {
      id: Number(person.id),
      fullName: String(person.fullName || ''),
      firstName: String(person.firstName || ''),
      lastName: String(person.lastName || ''),
      primaryPosition: String((person.primaryPosition as Record<string, unknown>)?.abbreviation || ''),
      bats: String((person.batSide as Record<string, string>)?.code || 'R'),
      throws: String((person.pitchHand as Record<string, string>)?.code || 'R'),
      currentTeam: person.currentTeam ? {
        id: Number((person.currentTeam as Record<string, unknown>).id),
        name: String((person.currentTeam as Record<string, unknown>).name || ''),
        abbreviation: String((person.currentTeam as Record<string, unknown>).abbreviation || ''),
      } : undefined,
    }
  } catch {
    console.warn('Failed to parse player info')
    return null
  }
}

export async function fetchStandings(date?: string): Promise<Record<string, unknown>[]> {
  const data = await mlFetch<{ records: { teamRecords: Record<string, unknown>[] }[] }>('/standings', {
    leagueId: '103,104',
    season: String(new Date().getFullYear()),
    ...(date ? { date } : {}),
  })

  return data.records?.flatMap((r) => r.teamRecords || []) || []
}

export async function fetchPlayerCareerStats(playerId: number): Promise<{ batting?: BattingStats; pitching?: PitchingStats }> {
  const data = await mlFetch<{ people: Record<string, unknown>[] }>(`/people/${playerId}`, {
    hydrate: `stats(group=[hitting,pitching],type=career,season=${getCurrentSeason()})`,
  })

  const person = data.people?.[0] as unknown as {
    id: number
    primaryPosition: { abbreviation: string }
    stats?: { splits: { stat: Record<string, unknown>; group: { displayName: string } }[] }[]
  } | undefined

  if (!person) return {}

  const isPitcher = person.primaryPosition?.abbreviation === 'P'
  const statsGroup = person.stats?.[0]
  if (!statsGroup?.splits?.length) return {}

  const result: { batting?: BattingStats; pitching?: PitchingStats } = {}

  for (const split of statsGroup.splits) {
    if (!split.group) continue
    const g = split.group.displayName

    if (isPitcher && g === 'pitching') {
      const s = split.stat as unknown as {
        wins?: number; losses?: number; era?: string; whip?: string
        gamesPitched?: number; gamesStarted?: number; inningsPitched?: string
        strikeouts?: number; baseOnBalls?: number; saves?: number; holds?: number
      }
      if (s.gamesPitched != null) {
        result.pitching = {
          type: 'pitching',
          wins: s.wins,
          losses: s.losses,
          era: s.era,
          whip: s.whip,
          games: s.gamesPitched,
          gamesStarted: s.gamesStarted,
          inningsPitched: s.inningsPitched,
          strikeouts: s.strikeouts,
          walks: s.baseOnBalls,
          saves: s.saves,
          holds: s.holds,
        }
      }
    } else if (!isPitcher && g === 'hitting') {
      const s = split.stat as unknown as {
        avg?: string; homeRuns?: number; rbi?: number; ops?: string
        obp?: string; slg?: string; gamesPlayed?: number; atBats?: number
        runs?: number; hits?: number; doubles?: number; triples?: number
        stolenBases?: number; baseOnBalls?: number; strikeouts?: number
      }
      if (s.gamesPlayed != null) {
        result.batting = {
          type: 'batting',
          avg: s.avg,
          hr: s.homeRuns,
          rbi: s.rbi,
          ops: s.ops,
          obp: s.obp,
          slg: s.slg,
          games: s.gamesPlayed,
          atBats: s.atBats,
          runs: s.runs,
          hits: s.hits,
          doubles: s.doubles,
          triples: s.triples,
          stolenBases: s.stolenBases,
          walks: s.baseOnBalls,
          strikeouts: s.strikeouts,
        }
      }
    }
  }

  return result
}

export async function fetchPlayerGameLog(playerId: number, limit?: number): Promise<GameLogEntry[]> {
  const data = await mlFetch<{ stats: { group: { displayName: string }; splits: Record<string, unknown>[] }[] }>(`/people/${playerId}/stats`, {
    stats: 'gameLog',
    season: getCurrentSeason(),
    group: 'hitting,pitching',
  })

  if (!data.stats?.length) return []

  const entries: GameLogEntry[] = []

  for (const statGroup of data.stats) {
    const group = statGroup.group?.displayName
    const splits = statGroup.splits || []

    for (const split of splits) {
      const s = split as unknown as {
        date: string
        stat: Record<string, unknown>
        opponent?: { id: number; name: string }
        isHome?: boolean
        isWin?: boolean
      }

      if (group === 'hitting') {
        const stat = s.stat as unknown as {
          atBats?: number; runs?: number; hits?: number; rbi?: number
          homeRuns?: number; baseOnBalls?: number; strikeouts?: number; avg?: string
        }
        entries.push({
          type: 'hitting',
          date: s.date,
          opponent: s.opponent?.name || '',
          isHome: s.isHome ?? true,
          isWin: s.isWin ?? false,
          ab: stat.atBats,
          runs: stat.runs,
          hits: stat.hits,
          rbi: stat.rbi,
          homeRuns: stat.homeRuns,
          walks: stat.baseOnBalls,
          strikeouts: stat.strikeouts,
          avg: stat.avg,
        })
      } else if (group === 'pitching') {
        const stat = s.stat as unknown as {
          inningsPitched?: string; hits?: number; runs?: number
          earnedRuns?: number; baseOnBalls?: number; strikeouts?: number
          note?: string
        }
        entries.push({
          type: 'pitching',
          date: s.date,
          opponent: s.opponent?.name || '',
          isHome: s.isHome ?? true,
          isWin: s.isWin ?? false,
          inningsPitched: stat.inningsPitched,
          hits: stat.hits,
          runs: stat.runs,
          earnedRuns: stat.earnedRuns,
          walks: stat.baseOnBalls,
          strikeouts: stat.strikeouts,
          note: stat.note,
        })
      }
    }
  }

  return entries.slice(0, limit ?? 10)
}

export async function fetchPlayerSplits(playerId: number): Promise<{ vsLhp?: VsSplit; vsRhp?: VsSplit }> {
  const data = await mlFetch<{ stats: { splits: Record<string, unknown>[] }[] }>(`/people/${playerId}/stats`, {
    stats: 'statSplits',
    season: getCurrentSeason(),
    group: 'hitting',
  })

  const statsGroup = data.stats?.[0]
  if (!statsGroup?.splits?.length) return {}

  const result: { vsLhp?: VsSplit; vsRhp?: VsSplit } = {}

  for (const split of statsGroup.splits) {
    const s = split as unknown as {
      stat: Record<string, unknown>
      split?: { code: string; description: string }
    }
    const code = s.split?.code
    const stat = s.stat as unknown as {
      avg?: string; obp?: string; slg?: string; ops?: string
      atBats?: number; hits?: number; homeRuns?: number; rbi?: number
      baseOnBalls?: number; strikeouts?: number
    }

    const vs: VsSplit = {
      avg: stat.avg,
      obp: stat.obp,
      slg: stat.slg,
      ops: stat.ops,
      ab: stat.atBats,
      hits: stat.hits,
      homeRuns: stat.homeRuns,
      rbi: stat.rbi,
      walks: stat.baseOnBalls,
      strikeouts: stat.strikeouts,
    }

    if (code === 'vsL' || code === 'vsLHP') {
      result.vsLhp = vs
    } else if (code === 'vsR' || code === 'vsRHP') {
      result.vsRhp = vs
    }
  }

  return result
}

export async function fetchGameLineup(gamePk: number): Promise<Record<string, unknown> | null> {
  try {
    const data = await mlFetch<Record<string, unknown>>(`/game/${gamePk}/boxscore`)
    return data
  } catch {
    console.warn('Failed to fetch game lineup')
    return null
  }
}
