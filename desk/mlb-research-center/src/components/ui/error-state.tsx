import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
      <p className="text-sm text-muted-foreground mb-3">{message || 'Something went wrong loading data'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" /> Retry
        </Button>
      )}
    </div>
  )
}

export function CardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="h-4 bg-muted/50 rounded w-1/3" />
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded w-full" />
            <div className="h-3 bg-muted/50 rounded w-3/4" />
          </div>
          <div className="h-3 bg-muted/50 rounded w-1/2" />
        </div>
      ))}
    </>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse p-4 space-y-2">
      <div className="flex gap-4 mb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-muted/50 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`h-3 bg-muted/50 rounded ${j === 0 ? 'flex-1' : 'w-12'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
