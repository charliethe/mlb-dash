'use client'

import { useEffect } from 'react'
import { useShortcutsModal } from '@/components/layout/shortcuts-context'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SHORTCUTS = [
  { keys: 'g d', label: 'Dashboard' },
  { keys: 'g s', label: 'Today\'s Slate' },
  { keys: 'g n', label: 'News' },
  { keys: 'g r', label: 'Roster' },
  { keys: 'g t', label: 'Standings' },
  { keys: 'g l', label: 'Lineup' },
  { keys: 'g w', label: 'Watchlist' },
  { keys: 'g e', label: 'Teams' },
  { keys: 'g o', label: 'Log' },
  { keys: 'g a', label: 'Alerts' },
  { keys: 'g ,', label: 'Settings' },
  { keys: 'g c', label: 'Compare' },
  { keys: '?', label: 'Show this menu' },
  { keys: 'Esc', label: 'Clear buffer / Close' },
]

export function ShortcutsModal() {
  const { open, setOpen } = useShortcutsModal()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1 text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="font-mono text-[11px] px-2 py-0.5 rounded border border-border bg-muted/30">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
