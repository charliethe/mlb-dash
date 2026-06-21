import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCache, setCache, clearCache } from '@/lib/cache'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '@/hooks/use-local-storage'

describe('Cache utility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores and retrieves values', () => {
    setCache('test-key', { foo: 'bar' }, 10)
    expect(getCache('test-key')).toEqual({ foo: 'bar' })
  })

  it('returns null for missing keys', () => {
    expect(getCache('nonexistent')).toBeNull()
  })

  it('expires entries after TTL', () => {
    vi.useFakeTimers()
    setCache('test-key', 'data', 1)
    vi.advanceTimersByTime(61 * 1000)
    expect(getCache('test-key')).toBeNull()
    vi.useRealTimers()
  })

  it('clears specific key', () => {
    setCache('key1', 'val1', 10)
    setCache('key2', 'val2', 10)
    clearCache('key1')
    expect(getCache('key1')).toBeNull()
    expect(getCache('key2')).toEqual('val2')
  })

  it('clears all keys', () => {
    setCache('key1', 'val1', 10)
    setCache('key2', 'val2', 10)
    clearCache()
    expect(getCache('key1')).toBeNull()
    expect(getCache('key2')).toBeNull()
  })

  it('handles localStorage errors gracefully', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => setCache('key', 'val', 10)).not.toThrow()
    setItem.mockRestore()
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('mlb-cache-corrupt', 'not-json')
    expect(getCache('corrupt')).toBeNull()
  })
})

describe('useLocalStorage hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default value when nothing stored', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('persists value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('persist-test', 'initial'))
    act(() => { result.current[1]('updated') })
    expect(result.current[0]).toBe('updated')
    expect(JSON.parse(localStorage.getItem('persist-test')!)).toBe('updated')
  })

  it('reads existing value from localStorage', () => {
    localStorage.setItem('existing-key', JSON.stringify('stored-val'))
    const { result } = renderHook(() => useLocalStorage('existing-key', 'default'))
    expect(result.current[0]).toBe('stored-val')
  })

  it('handles corrupt localStorage data', () => {
    localStorage.setItem('corrupt-key', 'not-json')
    const { result } = renderHook(() => useLocalStorage('corrupt-key', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('updater function works with prev value', () => {
    const { result } = renderHook(() => useLocalStorage<number>('counter', 0))
    act(() => { result.current[1]((prev) => prev + 1) })
    expect(result.current[0]).toBe(1)
  })
})

describe('Notification system', () => {
  it('imports useNotifications hook without error', async () => {
    const mod = await import('@/hooks/use-notifications')
    expect(mod.useNotifications).toBeDefined()
  })
})

describe('Compare page', () => {
  it('imports PlayerCompare without error', async () => {
    const mod = await import('@/components/compare/player-compare')
    expect(mod.PlayerCompare).toBeDefined()
  })

  it('imports TeamCompare without error', async () => {
    const mod = await import('@/components/compare/team-compare')
    expect(mod.TeamCompare).toBeDefined()
  })
})

describe('Dashboard widgets', () => {
  it('imports TopPerformers without error', async () => {
    const mod = await import('@/components/dashboard/widgets')
    expect(mod.TopPerformers).toBeDefined()
  })

  it('imports UpcomingWeek without error', async () => {
    const mod = await import('@/components/dashboard/widgets')
    expect(mod.UpcomingWeek).toBeDefined()
  })

  it('imports RecentTransactionsWidget without error', async () => {
    const mod = await import('@/components/dashboard/widgets')
    expect(mod.RecentTransactionsWidget).toBeDefined()
  })

  it('imports StandingsMini without error', async () => {
    const mod = await import('@/components/dashboard/widgets')
    expect(mod.StandingsMini).toBeDefined()
  })

  it('imports WeatherForecast without error', async () => {
    const mod = await import('@/components/dashboard/widgets')
    expect(mod.WeatherForecast).toBeDefined()
  })

  it('imports InjuryReport without error', async () => {
    const mod = await import('@/components/dashboard/widgets')
    expect(mod.InjuryReport).toBeDefined()
  })
})
