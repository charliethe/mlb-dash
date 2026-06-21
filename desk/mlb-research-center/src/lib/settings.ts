'use client'

export interface AppSettings {
  mlbEnabled: boolean
  espnEnabled: boolean
  foxEnabled: boolean
}

const DEFAULTS: AppSettings = {
  mlbEnabled: true,
  espnEnabled: true,
  foxEnabled: false,
}

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    return {
      mlbEnabled: JSON.parse(localStorage.getItem('settings-mlb-enabled') ?? 'true'),
      espnEnabled: JSON.parse(localStorage.getItem('settings-espn-enabled') ?? 'true'),
      foxEnabled: JSON.parse(localStorage.getItem('settings-fox-enabled') ?? 'false'),
    }
  } catch {
    console.warn('Failed to read settings from localStorage')
    return DEFAULTS
  }
}

export function isSourceEnabled(source: string): boolean {
  const settings = getSettings()
  switch (source) {
    case 'mlb.com': return settings.mlbEnabled
    case 'espn': return settings.espnEnabled
    case 'foxsports': return settings.foxEnabled
    default: return true
  }
}
