'use client'

import { createContext, useContext, useState } from 'react'

interface ShortcutsContextType {
  open: boolean
  setOpen: (v: boolean) => void
}

const ShortcutsContext = createContext<ShortcutsContextType>({ open: false, setOpen: () => {} })

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  return (
    <ShortcutsContext.Provider value={{ open: shortcutsOpen, setOpen: setShortcutsOpen }}>
      {children}
    </ShortcutsContext.Provider>
  )
}

export function useShortcutsModal() {
  return useContext(ShortcutsContext)
}
