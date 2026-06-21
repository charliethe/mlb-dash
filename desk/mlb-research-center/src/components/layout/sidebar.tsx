'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarDays,
  Newspaper,
  Users,
  LineChart,
  Star,
  Building2,
  ScrollText,
  ArrowLeftRight,
  Bell,
  StickyNote,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
  GitCompare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebar } from '@/components/layout/sidebar-context'

const COLLAPSED_KEY = 'sidebar-collapsed'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/slate', label: "Today's Slate", icon: CalendarDays },
  { href: '/news', label: 'News Feed', icon: Newspaper },
  { href: '/roster', label: 'Roster Tracker', icon: Users },
  { href: '/standings', label: 'Standings', icon: BarChart3 },
  { href: '/lineup', label: 'Lineup Center', icon: LineChart },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/teams', label: 'Teams', icon: Building2 },
  { href: '/compare', label: 'Compare', icon: GitCompare },
  { href: '/log', label: 'MLB Log', icon: ScrollText },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })
  const { mobileOpen, setMobileOpen } = useSidebar()

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-3 border-b border-border">
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight text-foreground">
            MLB Research
          </span>
        )}
        <div className="flex items-center gap-1">
          {mobileOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
      <nav className="flex-1 py-2 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">{item.label}</TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </nav>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-border bg-card transition-all duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
        <aside className={`relative w-64 h-full bg-card border-r border-border shadow-xl flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {sidebarContent}
        </aside>
      </div>
    </>
  )
}
