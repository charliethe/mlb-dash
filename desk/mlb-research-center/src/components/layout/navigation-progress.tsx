'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      setWidth(100)
      const t = setTimeout(() => { setVisible(false); setWidth(0) }, 300)
      prevPathRef.current = pathname
      return () => clearTimeout(t)
    }
  }, [pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = (target as HTMLAnchorElement).href
      if (!href || href.startsWith('javascript') || href.includes('#')) return
      if (href.startsWith(window.location.origin)) {
        setVisible(true)
        setWidth(30)
        setTimeout(() => setWidth(70), 200)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
