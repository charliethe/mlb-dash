'use client'

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'

interface NotificationOptions {
  title: string
  description?: string
  importance?: 'high' | 'medium' | 'low'
  url?: string
  onClick?: () => void
}

const PERMISSION_KEY = 'mlb-notification-permission'

export function useNotifications() {
  const requestedRef = useRef(false)

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied') return 'denied'
    if (requestedRef.current) return Notification.permission
    requestedRef.current = true
    const result = await Notification.requestPermission()
    localStorage.setItem(PERMISSION_KEY, result)
    return result
  }, [])

  const notify = useCallback(({ title, description, importance, url, onClick }: NotificationOptions) => {
    toast(title, {
      description,
      action: url ? { label: 'View', onClick: () => window.open(url, '_blank') } : undefined,
      ...(importance === 'high' ? { duration: 10000 } : {}),
    })

    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, {
        body: description,
        icon: '/icons/icon-192.svg',
      })
      if (onClick) {
        n.onclick = () => {
          window.focus()
          onClick()
        }
      } else if (url) {
        n.onclick = () => window.open(url, '_blank')
      }
    }
  }, [])

  return { notify, requestPermission }
}
