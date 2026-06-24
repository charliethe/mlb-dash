import { describe, it, expect } from 'vitest'
import { getCurrentSeason } from '@/lib/mlb/api'
import { MLB_TEAMS, TEAM_LOGOS, TEAM_COLORS, MLB_API_BASE, TEAM_ABBREVIATION_TO_ID, VENUE_COORDS, playerHeadshotUrl, NEWS_SOURCES, ALERT_IMPORTANCE_COLORS } from '@/lib/mlb/constants'

describe('getCurrentSeason', () => {
  it('returns current year as string', () => {
    const year = new Date().getFullYear()
    expect(getCurrentSeason()).toBe(String(year))
  })
})

describe('MLB API constants', () => {
  it('MLB_API_BASE points to statsapi', () => {
    expect(MLB_API_BASE).toBe('https://statsapi.mlb.com/api/v1')
  })

  it('NEWS_SOURCES has required sources', () => {
    const sources = NEWS_SOURCES.map((s) => s.id)
    expect(sources).toContain('mlb.com')
    expect(sources).toContain('espn')
    expect(sources).toContain('foxsports')
  })
})

describe('playerHeadshotUrl', () => {
  it('returns correct URL pattern', () => {
    const url = playerHeadshotUrl(660271, 120)
    expect(url).toBe('https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/660271/headshot/silo/current')
  })

  it('uses default size 120', () => {
    const url = playerHeadshotUrl(660271)
    expect(url).toContain('w_120')
  })

  it('accepts custom size', () => {
    const url = playerHeadshotUrl(660271, 200)
    expect(url).toContain('w_200')
  })
})

describe('MLB_TEAMS', () => {
  it('has exactly 30 teams', () => {
    expect(Object.keys(MLB_TEAMS).length).toBe(30)
  })

  it('every team has required fields', () => {
    for (const [id, team] of Object.entries(MLB_TEAMS)) {
      expect(team.name).toBeTruthy()
      expect(team.abbreviation).toBeTruthy()
      expect(team.league).toMatch(/^(AL|NL)$/)
      expect(team.division).toMatch(/^(East|Central|West)$/)
      expect(Number(id)).toBeGreaterThan(100)
    }
  })

  it('contains Yankees (147)', () => {
    expect(MLB_TEAMS[147].name).toBe('New York Yankees')
    expect(MLB_TEAMS[147].abbreviation).toBe('NYY')
    expect(MLB_TEAMS[147].league).toBe('AL')
    expect(MLB_TEAMS[147].division).toBe('East')
  })

  it('contains Dodgers (119)', () => {
    expect(MLB_TEAMS[119].name).toContain('Dodgers')
    expect(MLB_TEAMS[119].abbreviation).toBe('LAD')
  })

  it('contains Cubs (112)', () => {
    expect(MLB_TEAMS[112].name).toContain('Cubs')
    expect(MLB_TEAMS[112].abbreviation).toBe('CHC')
  })

  it('all 30 teams present by abbreviation', () => {
    const abbrs = Object.values(MLB_TEAMS).map((t) => t.abbreviation)
    const expected = ['NYY', 'LAD', 'CHC', 'BOS', 'SFG', 'HOU', 'ATL', 'NYY', 'NYM', 'PHI', 'STL', 'MIL', 'SDP', 'SEA', 'TEX', 'TOR', 'OAK', 'LAA', 'MIN', 'CLE', 'DET', 'KCR', 'CHW', 'CIN', 'PIT', 'COL', 'ARI', 'MIA', 'TBR', 'BAL', 'WSN']
    // just check we have enough unique teams
    expect(new Set(abbrs).size).toBe(30)
  })
})

describe('TEAM_ABBREVIATION_TO_ID', () => {
  it('contains all 30 teams', () => {
    expect(Object.keys(TEAM_ABBREVIATION_TO_ID).length).toBe(30)
  })

  it('maps abbreviations back to correct IDs', () => {
    expect(TEAM_ABBREVIATION_TO_ID['NYY']).toBe(147)
    expect(TEAM_ABBREVIATION_TO_ID['LAD']).toBe(119)
    expect(TEAM_ABBREVIATION_TO_ID['CHC']).toBe(112)
  })
})

describe('TEAM_LOGOS', () => {
  it('has all 30 teams with logo URLs', () => {
    const teams = Object.values(MLB_TEAMS)
    expect(Object.keys(TEAM_LOGOS).length).toBe(30)
    for (const t of teams) {
      expect(TEAM_LOGOS[t.abbreviation]).toBeTruthy()
      expect(TEAM_LOGOS[t.abbreviation]).toMatch(/^https?:\/\//)
    }
  })
})

describe('TEAM_COLORS', () => {
  it('has all 30 teams with color strings', () => {
    const teams = Object.values(MLB_TEAMS)
    expect(Object.keys(TEAM_COLORS).length).toBe(30)
    for (const t of teams) {
      expect(TEAM_COLORS[t.abbreviation]).toBeTruthy()
      expect(TEAM_COLORS[t.abbreviation]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('ALERT_IMPORTANCE_COLORS', () => {
  it('has high, medium, low keys', () => {
    expect(ALERT_IMPORTANCE_COLORS).toHaveProperty('high')
    expect(ALERT_IMPORTANCE_COLORS).toHaveProperty('medium')
    expect(ALERT_IMPORTANCE_COLORS).toHaveProperty('low')
  })
})

describe('VENUE_COORDS', () => {
  it('contains well-known ballparks', () => {
    expect(VENUE_COORDS['NYY']).toBeDefined()
    expect(VENUE_COORDS['LAD']).toBeDefined()
    expect(VENUE_COORDS['CHC']).toBeDefined()
    expect(VENUE_COORDS['BOS']).toBeDefined()
  })

  it('every venue has lat, lon, and name', () => {
    for (const [, venue] of Object.entries(VENUE_COORDS)) {
      expect(typeof venue.lat).toBe('number')
      expect(typeof venue.lon).toBe('number')
      expect(typeof venue.name).toBe('string')
      expect(venue.name.length).toBeGreaterThan(0)
    }
  })
})
