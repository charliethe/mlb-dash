'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const SHORTCUTS: Record<string, string> = {
  'g d': '/',
  'g s': '/slate',
  'g n': '/news',
  'g r': '/roster',
  'g t': '/transactions',
  'g p': '/standings',
  'g l': '/lineup',
  'g w': '/watchlist',
  'g e': '/teams',
  'g o': '/log',
  'g a': '/alerts',
  'g k': '/notes',
  'g c': '/compare',
  'g ,': '/settings',
}

export function useKeyboardShortcuts() {
  const router = useRouter()
  const bufferRef = useRef('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      bufferRef.current += e.key.toLowerCase()
      if (bufferRef.current.length > 3) bufferRef.current = bufferRef.current.slice(-3)

      for (const [keys, path] of Object.entries(SHORTCUTS)) {
        if (bufferRef.current.endsWith(keys)) {
          e.preventDefault()
          bufferRef.current = ''
          router.push(path)
          return
        }
      }

      if (e.key === 'Escape') {
        bufferRef.current = ''
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])
}
