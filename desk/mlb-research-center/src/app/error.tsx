'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
      <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button variant="outline" onClick={reset} className="gap-2">
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  )
}
