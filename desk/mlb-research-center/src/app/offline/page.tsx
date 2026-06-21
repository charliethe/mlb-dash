import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-5xl">⚾</div>
        <h1 className="text-xl font-semibold">You&apos;re Offline</h1>
        <p className="text-sm text-muted-foreground">
          The MLB Research Center needs an internet connection to fetch live data.
          Some cached pages may still be available.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs">Home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
