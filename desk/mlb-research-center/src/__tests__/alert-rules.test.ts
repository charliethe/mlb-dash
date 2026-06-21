import { describe, it, expect } from 'vitest'
import { classifyNewsItem, shouldCreateAlert, getGameAlertImportance } from '@/lib/alerts/rules'
import type { NewsItem, MLBGame, GameStatus, TeamGameInfo } from '@/types'

function makeNews(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: '1',
    source: 'mlb.com',
    title: 'Some news item',
    url: 'https://example.com',
    category: 'general',
    importance: 'low',
    publishedAt: new Date().toISOString(),
    summary: '',
    duplicateKey: '',
    playersMentioned: [],
    ...overrides,
  }
}

function makeGame(overrides: Partial<MLBGame> = {}): MLBGame {
  const baseStatus: GameStatus = {
    abstractGameState: 'Preview',
    codedGameState: 'S',
    detailedState: 'Scheduled',
    statusCode: 'S',
    startTimeTBD: false,
  }
  const baseTeamInfo: TeamGameInfo = {
    team: { id: 147, name: 'New York Yankees', abbreviation: 'NYY' },
  }
  return {
    gamePk: 1,
    gameDate: new Date().toISOString(),
    venue: 'Test Stadium',
    doubleHeader: 'N',
    gameType: 'R',
    status: baseStatus,
    teams: { away: baseTeamInfo, home: baseTeamInfo },
    ...overrides,
  }
}

describe('classifyNewsItem', () => {
  it('returns high importance for injured player news', () => {
    const item = makeNews({ category: 'injury' })
    const result = classifyNewsItem(item)
    expect(result.importance).toBe('high')
  })

  it('returns high importance for trade news', () => {
    const item = makeNews({ category: 'trade' })
    const result = classifyNewsItem(item)
    expect(result.importance).toBe('high')
  })

  it('returns medium importance for lineup news', () => {
    const item = makeNews({ category: 'lineup' })
    const result = classifyNewsItem(item)
    expect(result.importance).toBe('medium')
  })

  it('returns medium importance for roster move news', () => {
    const item = makeNews({ category: 'rosterMove' })
    const result = classifyNewsItem(item)
    expect(result.importance).toBe('medium')
  })

  it('returns low importance for general news', () => {
    const item = makeNews({ category: 'general' })
    const result = classifyNewsItem(item)
    expect(result.importance).toBe('low')
  })

  it('detects pitcher scratched from title', () => {
    const item = makeNews({ title: 'Cole scratched from start with forearm tightness' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('pitcherScratched')
    expect(result.importance).toBe('high')
  })

  it('detects trade from title', () => {
    const item = makeNews({ title: 'Soto traded to Yankees in blockbuster deal' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('trade')
    expect(result.importance).toBe('high')
  })

  it('detects IL placement from title', () => {
    const item = makeNews({ title: 'Acuña placed on IL with knee soreness' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('ilMove')
  })

  it('detects call up from title', () => {
    const item = makeNews({ title: 'Top prospect Holliday called up from Triple-A' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('majorCallUp')
  })

  it('detects postponement from title', () => {
    const item = makeNews({ title: 'Braves-Mets game postponed due to rain' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('weatherDelay')
  })

  it('detects lineup posted from title', () => {
    const item = makeNews({ title: 'Dodgers lineup announced for Game 1' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('lineupPosted')
    expect(result.importance).toBe('medium')
  })

  it('detects batting order change from title', () => {
    const item = makeNews({ title: 'Judge batting moved to leadoff spot' })
    const result = classifyNewsItem(item)
    expect(result.type).toBe('battingOrderChange')
  })

  it('returns low for non-matching title', () => {
    const item = makeNews({ title: 'MLB announces All-Star Game starters' })
    const result = classifyNewsItem(item)
    expect(result.importance).toBe('low')
  })
})

describe('shouldCreateAlert', () => {
  it('returns true for high importance news', () => {
    expect(shouldCreateAlert(makeNews({ category: 'injury' }))).toBe(true)
  })

  it('returns true for medium importance news', () => {
    expect(shouldCreateAlert(makeNews({ category: 'lineup' }))).toBe(true)
  })

  it('returns false for low importance news', () => {
    expect(shouldCreateAlert(makeNews({ category: 'general' }))).toBe(false)
  })
})

describe('getGameAlertImportance', () => {
  it('returns high for postponed games', () => {
    const game = makeGame({
      status: {
        abstractGameState: 'Preview',
        codedGameState: 'D',
        detailedState: 'Postponed',
        statusCode: 'D',
        startTimeTBD: false,
      },
    })
    expect(getGameAlertImportance(game)).toBe('high')
  })

  it('returns high for delayed games', () => {
    const game = makeGame({
      status: {
        abstractGameState: 'Preview',
        codedGameState: 'D',
        detailedState: 'Weather Delay',
        statusCode: 'D',
        startTimeTBD: false,
      },
    })
    expect(getGameAlertImportance(game)).toBe('high')
  })

  it('returns medium for pre-game', () => {
    const game = makeGame()
    expect(getGameAlertImportance(game)).toBe('medium')
  })

  it('returns null for live games', () => {
    const game = makeGame({
      status: {
        abstractGameState: 'Live',
        codedGameState: 'I',
        detailedState: 'In Progress',
        statusCode: 'I',
        startTimeTBD: false,
      },
    })
    expect(getGameAlertImportance(game)).toBeNull()
  })

  it('returns null for final games', () => {
    const game = makeGame({
      status: {
        abstractGameState: 'Final',
        codedGameState: 'F',
        detailedState: 'Final',
        statusCode: 'F',
        startTimeTBD: false,
      },
    })
    expect(getGameAlertImportance(game)).toBeNull()
  })
})
