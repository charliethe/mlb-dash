import { MLB_API_BASE } from './constants'
import type { MLBGame, MLBTeam, MLBPlayer, Transaction, TeamGameInfo, PitcherInfo, BattingStats, PitchingStats, GameLogEntry, VsSplit, PlayerSplitsData, StatLeaderEntry, AwardRecipient } from '@/types'
import { getCache as getCacheItem, setCache as setCacheItem } from '@/lib/cache'

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


const PROXY_MAP: Record<string, string> = {
  '/standings': '/api/proxy/standings',
  '/schedule': '/api/proxy/schedule',
  '/stats/leaders': '/api/proxy/leaders',
}

async function mlFetch<T>(path: string, params?: Record<string, string>, retries = MAX_RETRIES, signal?: AbortSignal): Promise<T> {
  const now = Date.now()
  while (REQUEST_LOG.length > 0 && REQUEST_LOG[0] < now - 1000) REQUEST_LOG.shift()
  if (REQUEST_LOG.length >= MAX_RPS) {
    const wait = REQUEST_LOG[0] + 1000 - now
    await new Promise((r) => setTimeout(r, wait + 50))
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  REQUEST_LOG.push(Date.now())

  const isBrowser = typeof window !== 'undefined'
  const proxyPath = PROXY_MAP[path]

  let url: string
  if (isBrowser && proxyPath) {
    const u = new URL(proxyPath, window.location.origin)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) u.searchParams.set(k, v)
      }
    }
    url = u.toString()
  } else {
    const u = new URL(`${MLB_API_BASE}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) u.searchParams.set(k, v)
      }
    }
    url = u.toString()
  }

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal,
    ...(isBrowser ? {} : { next: { revalidate: 60 } }),
  })

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 2
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return mlFetch<T>(path, params, retries - 1, signal)
  }

  if (!res.ok) {
    throw new MLBApiError(res.status, `MLB API ${res.status}: ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export async function fetchTodayGames(date?: string): Promise<MLBGame[]> {
  const gameDate = date || new Date().toISOString().split('T')[0]
  const cacheKey = `todayGames-${gameDate}`
  const cached = getCacheItem<MLBGame[]>(cacheKey)
  if (cached) return cached

  const data = await mlFetch<{ dates: { games: Record<string, unknown>[] }[] }>('/schedule', {
    date: gameDate,
    sportId: '1',
    hydrate: 'probablePitcher,team(leagueRecord),linescore',
  })

  if (!data.dates?.[0]?.games) return []
  const result = data.dates[0].games.map((g) => normalizeGame(g))
  setCacheItem(cacheKey, result, 1)
  return result
}

export async function fetchSeasonSeries(teamIdA: number, teamIdB: number, season?: string): Promise<MLBGame[]> {
  const s = season || getCurrentSeason()
  const cacheKey = `seasonSeries-${teamIdA}-${teamIdB}-${s}`
  const cached = getCacheItem<MLBGame[]>(cacheKey)
  if (cached) return cached

  try {
    const data = await mlFetch<{ dates: { games: Record<string, unknown>[] }[] }>('/schedule', {
      season: s,
      sportId: '1',
      teamId: String(teamIdA),
      opponentId: String(teamIdB),
      hydrate: 'probablePitcher,team(leagueRecord)',
    })
    if (!data.dates) return []
    const games: MLBGame[] = []
    for (const d of data.dates) {
      if (d.games) {
        for (const g of d.games) games.push(normalizeGame(g))
      }
    }
    const result = games.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
    setCacheItem(cacheKey, result, 5)
    return result
  } catch {
    return []
  }
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
  const cacheKey = `roster-${teamId}`
  const cached = getCacheItem<import('@/types').RosterPlayer[]>(cacheKey)
  if (cached) return cached

  const data = await mlFetch<{ roster: { person: { id: number; fullName: string; primaryNumber?: string; batSide?: { code: string; description: string }; pitchHand?: { code: string; description: string } }; position: { abbreviation: string }; jerseyNumber?: string; status: { description: string; code: string } }[] }>(`/teams/${teamId}/roster`, {
    rosterType: 'active',
    season: String(new Date().getFullYear()),
    hydrate: 'person',
  })

  if (!data.roster) return []

  const result = data.roster.map((entry) => ({
    playerId: entry.person.id,
    fullName: entry.person.fullName,
    position: entry.position.abbreviation,
    status: mapStatus(entry.status.code),
    jerseyNumber: entry.jerseyNumber,
    bats: entry.person.batSide?.code === 'R' ? 'R' : entry.person.batSide?.code === 'L' ? 'L' : entry.person.batSide?.code === 'S' ? 'S' : undefined,
    throws: entry.person.pitchHand?.code === 'R' ? 'R' : entry.person.pitchHand?.code === 'L' ? 'L' : undefined,
  }))
  setCacheItem(cacheKey, result, 5)
  return result
}

export async function fetchBulkPlayerStats(playerIds: number[]): Promise<Map<number, BattingStats | PitchingStats>> {
  if (playerIds.length === 0) return new Map()

  const cacheKey = `bulkStats-${playerIds.slice(0, 30).join(',')}`
  const cached = getCacheItem<[number, BattingStats | PitchingStats][]>(cacheKey)
  if (cached) return new Map(cached)

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
      stats?: { group: { displayName: string }; splits: { stat: Record<string, unknown> }[] }[]
    }
    const isPitcher = p.primaryPosition?.abbreviation === 'P'
    const statsGroups = p.stats || []

    for (const statsGroup of statsGroups) {
      const groupName = statsGroup.group?.displayName
      if (!groupName) continue
      if (!statsGroup.splits?.length) continue

      for (const split of statsGroup.splits) {
        if (isPitcher && groupName === 'pitching') {
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
        } else if (!isPitcher && groupName === 'hitting') {
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
  }

  setCacheItem(cacheKey, Array.from(statsMap.entries()), 5)
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
  const sd = startDate || today
  const ed = endDate || today
  const cacheKey = `transactions-${sd}-${ed}`
  const cached = getCacheItem<Transaction[]>(cacheKey)
  if (cached) return cached

  const data = await mlFetch<{ transactions: Record<string, unknown>[] }>('/transactions', {
    sportId: '1',
    startDate: sd,
    endDate: ed,
  })

  if (!data.transactions) return []

  const result = data.transactions.map((t: Record<string, unknown>) => ({
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
    fromTeam: String((t.fromTeam as Record<string, unknown>)?.abbreviation ?? ''),
    toTeam: String((t.team as Record<string, unknown>)?.abbreviation ?? ''),
  }))
  setCacheItem(cacheKey, result, 3)
  return result
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
      birthDate: person.birthDate as string | undefined,
      currentAge: person.currentAge as number | undefined,
      birthCity: person.birthCity as string | undefined,
      birthCountry: person.birthCountry as string | undefined,
      height: person.height as string | undefined,
      weight: person.weight as number | undefined,
      primaryNumber: person.primaryNumber as string | undefined,
      mlbDebutDate: person.mlbDebutDate as string | undefined,
      draftYear: person.draftYear as number | undefined,
      nickName: person.nickName as string | undefined,
    }
  } catch {
    console.warn('Failed to parse player info')
    return null
  }
}

const DIVISION_NAMES: Record<number, { name: string; abbreviation: string }> = {
  200: { name: 'AL West', abbreviation: 'ALW' },
  201: { name: 'AL East', abbreviation: 'ALE' },
  202: { name: 'AL Central', abbreviation: 'ALC' },
  203: { name: 'NL West', abbreviation: 'NLW' },
  204: { name: 'NL East', abbreviation: 'NLE' },
  205: { name: 'NL Central', abbreviation: 'NLC' },
}

export async function fetchStandings(date?: string, signal?: AbortSignal): Promise<{ records: { division: { id: number; name: string; abbreviation: string }; teamRecords: Record<string, unknown>[] }[] }> {
  const cacheKey = `standings-${date || 'latest'}`
  const cached = getCacheItem<{ records: { division: { id: number; name: string; abbreviation: string }; teamRecords: Record<string, unknown>[] }[] }>(cacheKey)
  if (cached) return cached

  const data = await mlFetch<{ records: { division: { id: number }; teamRecords: Record<string, unknown>[] }[] }>('/standings', {
    leagueId: '103,104',
    season: String(new Date().getFullYear()),
    ...(date ? { date } : {}),
  }, MAX_RETRIES, signal)

  if (!data?.records?.length) return { records: [] }

  const result = {
    records: data.records.map((r) => {
      const info = DIVISION_NAMES[r.division.id] || { name: `Division ${r.division.id}`, abbreviation: '' }
      return {
        division: { id: r.division.id, name: info.name, abbreviation: info.abbreviation },
        teamRecords: r.teamRecords || [],
      }
    }),
  }

  setCacheItem(cacheKey, result, 3)
  return result
}

export async function fetchPlayerCareerStats(playerId: number): Promise<{ batting?: BattingStats; pitching?: PitchingStats }> {
  const cacheKey = `careerStats-${playerId}`
  const cached = getCacheItem<{ batting?: BattingStats; pitching?: PitchingStats }>(cacheKey)
  if (cached) return cached

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
          completeGames?: number
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
            completeGames: s.completeGames,
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

  setCacheItem(cacheKey, result, 60)
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

export async function fetchBatterVsPitcher(batterId: number, pitcherId: number): Promise<VsSplit | null> {
  const cacheKey = `bvp-${batterId}-${pitcherId}`
  const cached = getCacheItem<VsSplit | null>(cacheKey)
  if (cached !== null) return cached

  try {
    const data = await mlFetch<{ stats: { splits: { stat: Record<string, unknown> }[] }[] }>(`/people/${batterId}/stats`, {
      stats: 'vsPlayer',
      vsPlayerId: String(pitcherId),
      season: getCurrentSeason(),
      group: 'hitting',
    })
    const statsGroup = data.stats?.[0]
    const split = statsGroup?.splits?.[0]?.stat
    if (!split) { setCacheItem(cacheKey, null, 10); return null }
    const result = {
      avg: split.avg as string,
      obp: split.obp as string,
      slg: split.slg as string,
      ops: split.ops as string,
      ab: split.atBats as number,
      hits: split.hits as number,
      homeRuns: split.homeRuns as number,
      rbi: split.rbi as number,
      walks: split.baseOnBalls as number,
      strikeouts: split.strikeouts as number,
    }
    setCacheItem(cacheKey, result, 10)
    return result
  } catch {
    setCacheItem(cacheKey, null, 10)
    return null
  }
}

export async function fetchPlayerSplits(playerId: number): Promise<PlayerSplitsData> {
  const cacheKey = `splits-${playerId}`
  const cached = getCacheItem<PlayerSplitsData>(cacheKey)
  if (cached) return cached

  const data = await mlFetch<{ stats: { splits: Record<string, unknown>[] }[] }>(`/people/${playerId}/stats`, {
    stats: 'statSplits',
    season: getCurrentSeason(),
    group: 'hitting',
  })

  const statsGroup = data.stats?.[0]
  if (!statsGroup?.splits?.length) return {}

  const result: PlayerSplitsData = {}
  const monthSplits: Record<string, VsSplit> = {}

  for (const split of statsGroup.splits) {
    const s = split as unknown as {
      stat: Record<string, unknown>
      split?: { code: string; description: string }
    }
    const code = s.split?.code || ''
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
    } else if (code === 'home') {
      result.home = vs
    } else if (code === 'away') {
      result.away = vs
    } else if (code === 'day') {
      result.day = vs
    } else if (code === 'night') {
      result.night = vs
    } else if (code === 'total') {
      // overall season totals, skip
    } else if (code.startsWith('month/')) {
      const monthName = code.replace('month/', '')
      monthSplits[monthName] = vs
    }
  }

  if (Object.keys(monthSplits).length > 0) {
    result.months = monthSplits
  }

  setCacheItem(cacheKey, result, 5)
  return result
}

export async function fetchStatLeaders(
  category: string,
  limit = 25,
  season?: string,
  statGroup?: string,
  leagueId?: string,
  playerPool?: string,
): Promise<StatLeaderEntry[]> {
  const cacheKey = `statLeaders-${category}-${limit}-${season || ''}-${statGroup || ''}-${leagueId || ''}-${playerPool || ''}`
  const cached = getCacheItem<StatLeaderEntry[]>(cacheKey)
  if (cached) return cached

  try {
    const params: Record<string, string> = {
      leaderCategories: category,
      limit: String(limit),
      leaderGameTypes: 'R',
      playerPool: playerPool ?? 'QUALIFIED',
    }
    if (season && season !== 'career') params.season = season
    else if (!season) params.season = getCurrentSeason()
    if (statGroup) params.statGroup = statGroup
    if (leagueId) params.leagueId = leagueId

    const data = await mlFetch<{
      leagueLeaders: {
        leaderCategory: string
        season: string
        leaders: {
          rank: number
          value: string | number
          person: { id: number; fullName: string }
          team: { id: number; name: string; abbreviation: string }
        }[]
      }[]
    }>('/stats/leaders', params)

    const leaders = data.leagueLeaders?.[0]?.leaders || []
    const result = leaders.map((l) => ({
      rank: l.rank,
      value: typeof l.value === 'string' ? parseFloat(l.value) : l.value,
      playerId: l.person.id,
      playerName: l.person.fullName,
      teamId: l.team.id,
      teamAbbreviation: l.team.abbreviation,
    }))
    setCacheItem(cacheKey, result, 5)
    return result
  } catch {
    return []
  }
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

export async function fetchTeamSchedule(teamId: number, startDate: string, endDate: string): Promise<MLBGame[]> {
  const cacheKey = `teamSchedule-${teamId}-${startDate}-${endDate}`
  const cached = getCacheItem<MLBGame[]>(cacheKey)
  if (cached) return cached

  try {
    const data = await mlFetch<{ dates: { games: Record<string, unknown>[] }[] }>('/schedule', {
      sportId: '1',
      teamId: String(teamId),
      startDate,
      endDate,
      hydrate: 'linescore',
    })
    const result = data.dates?.flatMap((d) => (d.games || []).map((g) => normalizeGame(g))) || []
    setCacheItem(cacheKey, result, 5)
    return result
  } catch {
    return []
  }
}

export async function fetchStandingsForTeam(team: { id: number; league: string; division: string }): Promise<{
  division: string
  records: { teamId: number; name: string; abbreviation: string; wins: number; losses: number; pct: string; gb: string; streak: string; l10: string }[]
} | null> {
  const leagueId = team.league === 'AL' ? '103' : '104'
  const cacheKey = `standingsForTeam-${team.id}-${leagueId}`
  const cached = getCacheItem<{
    division: string
    records: { teamId: number; name: string; abbreviation: string; wins: number; losses: number; pct: string; gb: string; streak: string; l10: string }[]
  } | null>(cacheKey)
  if (cached !== null) return cached

  try {
    const data = await mlFetch<{ records: { division: { name: string }; teamRecords: Record<string, unknown>[] }[] }>('/standings', {
      leagueId,
      season: String(new Date().getFullYear()),
    })
    const div = data.records?.find((r) => r.division?.name.endsWith(` ${team.division}`) || r.division?.name === team.division)
    if (!div) return null

    const records = div.teamRecords.map((tr) => {
      const t = tr as unknown as {
        team: { id: number; name: string; abbreviation: string }
        leagueRecord: { wins: number; losses: number; pct: string }
        gamesBack: string
        streak?: { streakCode: string; streakNumber: number }
        last10?: { wins: number; losses: number; pct: string }
      }
      return {
        teamId: t.team.id,
        name: t.team.name,
        abbreviation: t.team.abbreviation,
        wins: t.leagueRecord.wins,
        losses: t.leagueRecord.losses,
        pct: t.leagueRecord.pct,
        gb: t.gamesBack,
        streak: t.streak ? `${t.streak.streakCode}${t.streak.streakNumber}` : '-',
        l10: t.last10 ? `${t.last10.wins}-${t.last10.losses}` : '-',
      }
    })
    const result = { division: div!.division.name, records }
    setCacheItem(cacheKey, result, 3)
    return result
  } catch {
    setCacheItem(cacheKey, null, 3)
    return null
  }
}

export interface TeamSeasonStats {
  teamId: number
  batting?: { avg: string; hr: number; rbi: number; ops: string; slg: string; obp: string; runs: number; sb: number; h: number }
  pitching?: { era: string; whip: string; so: number; bb: number; sv: number; hr: number; baAgainst: string; runs: number }
}

export async function fetchTeamSeasonStats(teamId: number): Promise<TeamSeasonStats> {
  const cacheKey = `teamSeasonStats-${teamId}`
  const cached = getCacheItem<TeamSeasonStats>(cacheKey)
  if (cached) return cached

  try {
    const data = await mlFetch<{
      stats: { group: { displayName: string }; splits: { stat: Record<string, unknown> }[] }[]
    }>(`/teams/${teamId}/stats`, {
      season: getCurrentSeason(),
      group: 'hitting,pitching',
      type: 'season',
    })
    const result: TeamSeasonStats = { teamId }
    for (const sg of data.stats || []) {
      const group = sg.group.displayName
      const s = sg.splits?.[0]?.stat
      if (!s) continue
      if (group === 'hitting') {
        result.batting = {
          avg: String(s.avg || ''),
          hr: Number(s.homeRuns || 0),
          rbi: Number(s.rbi || 0),
          ops: String(s.ops || ''),
          slg: String(s.slg || ''),
          obp: String(s.obp || ''),
          runs: Number(s.runs || 0),
          sb: Number(s.stolenBases || 0),
          h: Number(s.hits || 0),
        }
      } else if (group === 'pitching') {
        result.pitching = {
          era: String(s.era || ''),
          whip: String(s.whip || ''),
          so: Number(s.strikeouts || 0),
          bb: Number(s.baseOnBalls || 0),
          sv: Number(s.saves || 0),
          hr: Number(s.homeRuns || 0),
          baAgainst: String(s.avg || ''),
          runs: Number(s.runs || 0),
        }
      }
    }
    setCacheItem(cacheKey, result, 5)
    return result
  } catch {
    return { teamId }
  }
}

export async function fetchAwardRecipients(awardId: string, season?: string, leagueId?: string): Promise<AwardRecipient[]> {
  const cacheKey = `awardRecipients-${awardId}-${season || ''}-${leagueId || ''}`
  const cached = getCacheItem<AwardRecipient[]>(cacheKey)
  if (cached) return cached

  try {
    const params: Record<string, string> = { sportId: '1' }
    if (season) params.season = season
    else params.season = getCurrentSeason()
    if (leagueId) params.leagueId = leagueId

    const data = await mlFetch<{ awards: Record<string, unknown>[] }>(`/awards/${awardId}/recipients`, params)
    const award = data.awards?.[0]
    if (!award?.recipients) return []

    const result = (award.recipients as Record<string, unknown>[]).map((r: Record<string, unknown>) => ({
      awardId: String(award.id || ''),
      awardName: String(award.name || ''),
      date: String(r.date || ''),
      season: String(r.season || ''),
      playerId: Number((r.player as Record<string, unknown>)?.id || 0),
      playerName: String((r.player as Record<string, unknown>)?.fullName || ''),
      teamId: Number((r.team as Record<string, unknown>)?.id || 0),
      teamName: String((r.team as Record<string, unknown>)?.name || ''),
      teamAbbreviation: String((r.team as Record<string, unknown>)?.abbreviation || ''),
      votes: Number(r.votes || 0),
    }))
    setCacheItem(cacheKey, result, 10)
    return result
  } catch {
    return []
  }
}
