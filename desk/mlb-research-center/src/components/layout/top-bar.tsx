'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Loader2, Menu, Sun, Moon, Keyboard } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { TEAM_LOGOS, MLB_TEAMS } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { useSidebar } from '@/components/layout/sidebar-context'
import { useShortcutsModal } from '@/components/layout/shortcuts-context'
import { getUnreadAlerts } from '@/lib/supabase/client'

const ALERT_COUNT_KEY = 'mlb-alert-count'

function readAlertCount(): number {
  try {
    const v = localStorage.getItem(ALERT_COUNT_KEY)
    return v ? parseInt(v, 10) : 0
  } catch { return 0 }
}

interface SearchResult {
  type: 'player' | 'team'
  id: number
  label: string
  sublabel: string
  logo?: string
  abbreviation?: string
}

export function TopBar() {
  const router = useRouter()
  const { setMobileOpen } = useSidebar()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const { theme, setTheme } = useTheme()
  const { setOpen: setShortcutsOpen } = useShortcutsModal()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setAlertCount(readAlertCount())
    getUnreadAlerts().then((alerts) => setAlertCount(alerts.length)).catch(() => console.warn('Failed to fetch alert count'))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      const teamHit = Object.values(MLB_TEAMS).find(
        (t) => t.name.toLowerCase().includes(search.toLowerCase()) ||
              t.abbreviation.toLowerCase().includes(search.toLowerCase())
      )
      if (teamHit) {
        const teamId = Object.entries(MLB_TEAMS).find(([, t]) => t.abbreviation === teamHit.abbreviation)?.[0]
        if (teamId) {
          router.push(`/teams/${teamId}`)
          setShowDropdown(false)
          setSearch('')
          return
        }
      }
      router.push(`/search?q=${encodeURIComponent(search.trim())}`)
      setShowDropdown(false)
      setSearch('')
    }
  }

  const handleInputChange = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    // Show team matches immediately
    const q = value.toLowerCase()
    const teamResults: SearchResult[] = Object.entries(MLB_TEAMS)
      .filter(([, t]) => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q))
      .map(([id, t]) => ({
        type: 'team' as const,
        id: Number(id),
        label: `${t.abbreviation} — ${t.name}`,
        sublabel: `${t.league} ${t.division}`,
        abbreviation: t.abbreviation,
        logo: TEAM_LOGOS[t.abbreviation],
      }))

    setResults(teamResults)
    setShowDropdown(teamResults.length > 0)

    // Also search players via MLB API
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/player-search?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const data = await res.json()
        const people = data.players || []
        const playerResults: SearchResult[] = people.slice(0, 5).map((p: { id: number; fullName: string; pos: string; team: string }) => ({
          type: 'player' as const,
          id: p.id,
          label: p.fullName,
          sublabel: `${p.pos || '?'} · ${p.team || 'FA'}`,
        }))
        setResults([...teamResults, ...playerResults])
        setShowDropdown([...teamResults, ...playerResults].length > 0)
      } catch {
        // fallback to teams only
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  function handleSelect(result: SearchResult) {
    setShowDropdown(false)
    setSearch('')
    if (result.type === 'team') {
      router.push(`/teams/${result.id}`)
    } else {
      router.push(`/players/${result.id}`)
    }
  }

  return (
    <header className="flex items-center gap-4 px-6 h-14 border-b border-border bg-card shrink-0">
      <button
        className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>
      <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search players, teams..."
            aria-label="Search players and teams"
            value={search}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="pl-9 h-9 bg-muted/50 border-muted"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg z-50 overflow-hidden"
          >
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <LogoImage src={r.logo} alt={`${r.abbreviation} logo`} className="h-5 w-5 shrink-0" />
                {r.type === 'player' && !r.logo && (
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                    {r.label.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r.sublabel}</p>
                </div>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase shrink-0">
                  {r.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </form>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hidden sm:inline-flex"
          aria-label="Keyboard shortcuts"
          onClick={() => setShortcutsOpen(true)}
        >
          <Keyboard className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="View alerts"
          onClick={() => router.push('/alerts')}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
