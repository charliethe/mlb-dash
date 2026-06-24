'use client'

import { useState, useEffect } from 'react'
import { fetchAwardRecipients, getCurrentSeason } from '@/lib/mlb/api'
import { TEAM_LOGOS, playerHeadshotUrl } from '@/lib/mlb/constants'
import { LogoImage } from '@/components/ui/logo-image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton, ErrorState } from '@/components/ui/error-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { FreshnessIndicator } from '@/components/ui/freshness-indicator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Medal, Trophy, Award } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { AwardRecipient } from '@/types'

const SEASON = getCurrentSeason()

interface MonthlyAwardGroup {
  month: string
  recipients: AwardRecipient[]
}

function groupByMonth(recipients: AwardRecipient[]): MonthlyAwardGroup[] {
  const groups = new Map<string, AwardRecipient[]>()
  for (const r of recipients) {
    const month = r.date.slice(0, 7)
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month)!.push(r)
  }
  return Array.from(groups.entries())
    .map(([month, recipients]) => ({ month, recipients }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

function AwardCard({ recipient }: { recipient: AwardRecipient }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
        <img
          src={playerHeadshotUrl(recipient.playerId, 64)}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/players/${recipient.playerId}`}
          className="text-sm font-medium hover:text-primary transition-colors"
        >
          {recipient.playerName}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          {TEAM_LOGOS[recipient.teamAbbreviation] && (
            <LogoImage src={TEAM_LOGOS[recipient.teamAbbreviation]} alt="" className="h-3.5 w-3.5" />
          )}
          <Link href={`/teams/${recipient.teamId}`} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
            {recipient.teamName}
          </Link>
        </div>
      </div>
      {recipient.votes > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {recipient.votes} votes
        </Badge>
      )}
    </div>
  )
}

function MonthSection({ month, recipients }: {
  month: string
  recipients: AwardRecipient[]
}) {
  const date = parseISO(month + '-01')
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {format(date, 'MMMM yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {recipients.map((r) => (
            <AwardCard key={r.playerId + r.date} recipient={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function MonthlyAwardsPage() {
  useEffect(() => { document.title = 'Monthly Awards — MLB Research' }, [])
  return (
    <ErrorBoundary name="MonthlyAwards">
      <MonthlyAwardsContent />
    </ErrorBoundary>
  )
}

function MonthlyAwardsContent() {
  const [awardType, setAwardType] = useState<'POM' | 'PPOM'>('POM')
  const [groups, setGroups] = useState<MonthlyAwardGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    loadAwards()
  }, [awardType])

  async function loadAwards() {
    setLoading(true)
    setError(false)
    try {
      const [al, nl] = await Promise.all([
        fetchAwardRecipients(`MLB${awardType}`, SEASON, '103'),
        fetchAwardRecipients(`MLB${awardType}`, SEASON, '104'),
      ])
      const all = [...al, ...nl]
      setGroups(groupByMonth(all))
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Medal className="h-4 w-4 text-muted-foreground" />
          Monthly Awards
          <span className="text-xs text-muted-foreground font-normal">{SEASON}</span>
        </h1>
        <FreshnessIndicator lastUpdated={lastUpdated} loading={loading} onRefresh={loadAwards} />
      </div>

      <Tabs value={awardType} onValueChange={(v) => v && setAwardType(v as 'POM' | 'PPOM')}>
        <TabsList>
          <TabsTrigger value="POM" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Player of the Month
          </TabsTrigger>
          <TabsTrigger value="PPOM" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> Pitcher of the Month
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <CardSkeleton count={4} />
      ) : error ? (
        <ErrorState message="Failed to load monthly awards" onRetry={loadAwards} />
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-xs">
            No monthly awards found for {SEASON}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <MonthSection
              key={g.month}
              month={g.month}
              recipients={g.recipients}
            />
          ))}
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
