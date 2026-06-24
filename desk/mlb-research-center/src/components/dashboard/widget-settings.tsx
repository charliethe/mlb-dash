'use client'

import { useState, useRef, useEffect } from 'react'
import { WIDGET_DEFS, useDashboardWidgets } from '@/hooks/use-dashboard-widgets'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

export function DashboardWidgetSettings() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { isVisible, toggle, hiddenCount } = useDashboardWidgets()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <Eye className="h-3 w-3" />
        Widgets
        {hiddenCount > 0 && (
          <span className="text-[10px] text-muted-foreground">({hiddenCount} hidden)</span>
        )}
      </Button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 w-48 py-1 max-h-72 overflow-y-auto">
          {WIDGET_DEFS.map((w) => (
            <button
              key={w.id}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left transition-colors cursor-pointer"
              onClick={() => toggle(w.id)}
            >
              {isVisible(w.id) ? (
                <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
              <span className={isVisible(w.id) ? '' : 'text-muted-foreground/60'}>{w.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
