'use client'

import { useState } from 'react'

export function LogoImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={`bg-muted rounded-full flex items-center justify-center text-[10px] font-medium text-muted-foreground ${className || ''}`}>
        {alt.charAt(0)}
      </div>
    )
  }

  return (
    <div className={`relative ${className || ''}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-muted rounded-full animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className || ''} ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
