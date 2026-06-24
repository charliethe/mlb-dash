'use client'

import { useEffect } from 'react'
import { NewsFeed } from '@/components/news/news-feed'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function NewsPage() {
  useEffect(() => { document.title = 'News — MLB Research' }, [])
  return (
    <ErrorBoundary name="News">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">News Feed</h1>
        <p className="text-xs text-muted-foreground">
          MLB.com, ESPN, and FOX Sports headlines — categorized and deduplicated
        </p>
        <NewsFeed />
        <ScrollToTop />
      </div>
    </ErrorBoundary>
  )
}
