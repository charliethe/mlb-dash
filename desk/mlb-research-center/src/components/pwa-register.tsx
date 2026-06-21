'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (!deferredPrompt) return

    function dismissedHandler() { setDeferredPrompt(null) }
    window.addEventListener('appinstalled', dismissedHandler)
    return () => window.removeEventListener('appinstalled', dismissedHandler)
  }, [deferredPrompt])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (!deferredPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-lg animate-in slide-in-from-bottom-2">
      <span className="text-xs text-muted-foreground">Install MLB Research Center</span>
      <button
        onClick={handleInstall}
        className="text-xs font-medium text-primary hover:underline cursor-pointer"
      >
        Install
      </button>
      <button
        onClick={() => setDeferredPrompt(null)}
        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
