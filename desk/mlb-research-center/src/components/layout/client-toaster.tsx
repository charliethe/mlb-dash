'use client'

import dynamic from 'next/dynamic'

const SonnerToaster = dynamic(() => import('@/components/ui/sonner').then((m) => m.Toaster), {
  ssr: false,
})

export function ClientToaster() {
  return <SonnerToaster />
}
