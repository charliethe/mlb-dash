import type { AlertType, AlertImportance, NewsItem, NewsCategory, MLBGame } from '@/types'

export interface AlertRule {
  type: AlertType
  importance: AlertImportance
  description: string
  match: (item: AlertableItem) => boolean
}

export type AlertableItem = NewsItem | { type: 'gameEvent'; game: MLBGame; event: string; details: Record<string, unknown> }



function classifyNewsCategory(category: NewsCategory): AlertImportance {
  switch (category) {
    case 'injury':
    case 'trade':
    case 'pitcherChange':
      return 'high'
    case 'rosterMove':
    case 'lineup':
    case 'bullpen':
      return 'medium'
    default:
      return 'low'
  }
}

function classifyNewsTitle(title: string): { type?: AlertType; importance: AlertImportance } {
  const lower = title.toLowerCase()

  if (lower.includes('scratched') || lower.includes('scratched from start')) {
    return { type: 'pitcherScratched', importance: 'high' }
  }
  if (lower.includes('traded') || lower.includes('acquired') || lower.includes('trade')) {
    return { type: 'trade', importance: 'high' }
  }
  if (lower.includes('placed on') && (lower.includes('il') || lower.includes('injured list') || lower.includes('dl'))) {
    return { type: 'ilMove', importance: 'high' }
  }
  if (lower.includes('activated') && (lower.includes('il') || lower.includes('injured'))) {
    return { type: 'injuryUpdate', importance: 'high' }
  }
  if (lower.includes('recalled') || lower.includes('called up') || lower.includes('call up')) {
    return { type: 'majorCallUp', importance: 'high' }
  }
  if (lower.includes('postponed') || lower.includes('delay') || lower.includes('rain delay') || lower.includes('weather')) {
    return { type: 'weatherDelay', importance: 'high' }
  }
  if (lower.includes('closer') || lower.includes('save opportunity')) {
    return { type: 'closerUnavailable', importance: 'high' }
  }
  if (lower.includes('not in lineup') || lower.includes('out of lineup') || lower.includes('resting')) {
    return { type: 'keyPlayerOut', importance: 'high' }
  }
  if (lower.includes('lineup') && (lower.includes('announced') || lower.includes('posted') || lower.includes('released'))) {
    return { type: 'lineupPosted', importance: 'medium' }
  }
  if (lower.includes('batting') && (lower.includes('leadoff') || lower.includes('moved to') || lower.includes('dropped to'))) {
    return { type: 'battingOrderChange', importance: 'medium' }
  }
  if (lower.includes('optioned') || lower.includes('dfa') || lower.includes('designated for')) {
    return { type: 'rosterMove', importance: 'medium' }
  }
  if (lower.includes('bullpen') || lower.includes('reliever') || lower.includes('pen usage')) {
    return { type: 'bullpenConcern', importance: 'medium' }
  }

  return { importance: 'low' }
}

export function classifyNewsItem(item: NewsItem): { type?: AlertType; importance: AlertImportance } {
  if (item.importance !== 'low') {
    return { importance: item.importance === 'high' ? 'high' : 'medium', type: undefined }
  }

  const fromTitle = classifyNewsTitle(item.title)
  if (fromTitle.type) return fromTitle

  const fromCategory = classifyNewsCategory(item.category)
  return { importance: fromCategory }
}

export function shouldCreateAlert(item: AlertableItem): boolean {
  if ('title' in item) {
    const { importance } = classifyNewsItem(item)
    return importance === 'high' || importance === 'medium'
  }
  return false
}

export function getGameAlertImportance(game: MLBGame): AlertImportance | null {
  const status = game.status.abstractGameState
  const detail = game.status.detailedState

  if (detail?.toLowerCase().includes('postponed') || detail?.toLowerCase().includes('delay')) {
    return 'high'
  }
  if (status === 'Preview' || status === 'Pre-Game') {
    return 'medium'
  }
  return null
}
