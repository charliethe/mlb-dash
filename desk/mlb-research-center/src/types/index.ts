export interface MLBTeam {
  id: number
  name: string
  abbreviation: string
  teamName: string
  locationName: string
  league: League
  division: Division
}

export interface League {
  id: number
  name: string
}

export interface Division {
  id: number
  name: string
}

export interface MLBGame {
  gamePk: number
  gameDate: string
  status: GameStatus
  teams: {
    away: TeamGameInfo
    home: TeamGameInfo
  }
  venue: string
  doubleHeader: string
  gameType: string
}

export interface GameStatus {
  abstractGameState: string
  codedGameState: string
  detailedState: string
  statusCode: string
  startTimeTBD: boolean
}

export interface TeamGameInfo {
  team: {
    id: number
    name: string
    abbreviation: string
  }
  score?: number
  probablePitcher?: PitcherInfo
  lineupStatus?: LineupStatus
  leagueRecord?: {
    wins: number
    losses: number
    pct: string
  }
}

export interface PitcherInfo {
  id: number
  fullName: string
  wins?: number
  losses?: number
  era?: string
  throws?: string
}

export interface LineupStatus {
  isConfirmed: boolean
  battingOrder: LineupBatter[]
  missingStarters?: string[]
  catcherRestDay?: boolean
  lineupStrength?: 'strong' | 'normal' | 'weak'
}

export interface LineupBatter {
  id: number
  fullName: string
  position: string
  battingOrder: number
  bats: string
}

export interface MLBPlayer {
  id: number
  fullName: string
  firstName: string
  lastName: string
  primaryPosition: string
  bats: string
  throws: string
  currentTeam?: {
    id: number
    name: string
    abbreviation: string
  }
  stats?: PlayerStats
  birthDate?: string
  currentAge?: number
  birthCity?: string
  birthCountry?: string
  height?: string
  weight?: number
  primaryNumber?: string
  mlbDebutDate?: string
  draftYear?: number
  nickName?: string
}

export interface PlayerStats {
  batting?: BattingStats
  pitching?: PitchingStats
}

export interface Transaction {
  id: string
  date: string
  team: {
    id: number
    name: string
    abbreviation: string
  }
  player: {
    id: number
    fullName: string
  }
  type: TransactionType
  description: string
  fromTeam?: string
  toTeam?: string
}

export type TransactionType =
  | 'callUp'
  | 'optioned'
  | 'dfa'
  | 'traded'
  | 'released'
  | 'signed'
  | 'ilActivation'
  | 'ilPlacement'
  | 'purchase'
  | 'waiverClaim'
  | 'freeAgentSigning'
  | 'other'

export interface NewsItem {
  id: string
  source: NewsSource
  title: string
  url: string
  teamId?: number
  teamAbbreviation?: string
  playersMentioned: string[]
  category: NewsCategory
  importance: AlertImportance
  publishedAt: string
  summary: string
  duplicateKey: string
}

export type NewsSource = 'mlb.com' | 'espn' | 'foxsports'

export type NewsCategory =
  | 'injury'
  | 'rosterMove'
  | 'lineup'
  | 'trade'
  | 'prospect'
  | 'recap'
  | 'preview'
  | 'weather'
  | 'pitcherChange'
  | 'bullpen'
  | 'general'

export type AlertImportance = 'high' | 'medium' | 'low'

export interface Alert {
  id: string
  type: AlertType
  teamId?: number
  teamAbbreviation?: string
  playerId?: number
  playerName?: string
  title: string
  importance: AlertImportance
  reason: string
  sourceUrl?: string
  createdAt: string
  readStatus: boolean
}

export type AlertType =
  | 'pitcherScratched'
  | 'keyPlayerOut'
  | 'injuryUpdate'
  | 'ilMove'
  | 'trade'
  | 'majorCallUp'
  | 'closerUnavailable'
  | 'postponement'
  | 'weatherDelay'
  | 'lineupPosted'
  | 'battingOrderChange'
  | 'rosterMove'
  | 'bullpenConcern'
  | 'restingStarters'
  | 'minorUpdate'

export interface DailyLogEntry {
  id: string
  date: string
  category: DailyLogCategory
  text: string
  sourceUrl?: string
  importance: AlertImportance
  createdAt: string
}

export type DailyLogCategory =
  | 'lineup'
  | 'transaction'
  | 'injury'
  | 'pitcherChange'
  | 'rosterMove'
  | 'bullpen'
  | 'weather'
  | 'gameNote'
  | 'recap'
  | 'researchNote'
  | 'callUp'
  | 'trade'

export interface WatchlistItem {
  id: string
  playerId: number
  playerName: string
  teamAbbreviation?: string
  notes?: string
  createdAt: string
}

export interface ResearchNote {
  id: string
  date: string
  title: string
  content: string
  tags: string[]
  teamIds: number[]
  playerIds: number[]
  sourceUrls: string[]
  createdAt: string
}

export interface Roster {
  teamId: number
  teamAbbreviation: string
  season: string
  players: RosterPlayer[]
  lastUpdated: string
}

export interface RosterPlayer {
  playerId: number
  fullName: string
  position: string
  status: RosterStatus
  jerseyNumber?: string
  bats?: string
  throws?: string
  seasonStats?: BattingStats | PitchingStats
}

export interface BattingStats {
  type: 'batting'
  avg?: string
  hr?: number
  rbi?: number
  ops?: string
  obp?: string
  slg?: string
  games?: number
  atBats?: number
  runs?: number
  hits?: number
  doubles?: number
  triples?: number
  stolenBases?: number
  walks?: number
  strikeouts?: number
}

export interface PitchingStats {
  type: 'pitching'
  wins?: number
  losses?: number
  era?: string
  whip?: string
  games?: number
  gamesStarted?: number
  inningsPitched?: string
  strikeouts?: number
  walks?: number
  saves?: number
  holds?: number
  blownSaves?: number
  completeGames?: number
}

export interface GameLogEntry {
  type: 'hitting' | 'pitching'
  date: string
  opponent: string
  isHome: boolean
  isWin: boolean
  ab?: number
  runs?: number
  hits?: number
  rbi?: number
  homeRuns?: number
  avg?: string
  inningsPitched?: string
  earnedRuns?: number
  note?: string
  walks?: number
  strikeouts?: number
}

export interface VsSplit {
  avg?: string
  obp?: string
  slg?: string
  ops?: string
  ab?: number
  hits?: number
  homeRuns?: number
  rbi?: number
  walks?: number
  strikeouts?: number
}

export interface PlayerSplitsData {
  vsLhp?: VsSplit
  vsRhp?: VsSplit
  home?: VsSplit
  away?: VsSplit
  day?: VsSplit
  night?: VsSplit
  months?: Record<string, VsSplit>
}

export type RosterStatus =
  | 'active'
  | 'il'
  | 'il-7'
  | 'il-10'
  | 'il-15'
  | 'il-60'
  | 'paternity'
  | 'restricted'
  | 'suspended'
  | 'bereavement'
  | 'minors'
  | 'dfa'

export interface StatLeaderEntry {
  rank: number
  value: number
  playerId: number
  playerName: string
  teamId: number
  teamAbbreviation: string
}

export interface AwardRecipient {
  awardId: string
  awardName: string
  date: string
  season: string
  playerId: number
  playerName: string
  teamId: number
  teamName: string
  teamAbbreviation: string
  votes: number
}
