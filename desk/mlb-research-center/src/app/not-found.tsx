import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
      <p className="text-lg text-foreground mb-2">Page not found</p>
      <p className="text-sm text-muted-foreground mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="outline" className="gap-2">
          <Home className="h-4 w-4" /> Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}
