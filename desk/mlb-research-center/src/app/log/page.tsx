'use client'

import { useState, useEffect } from 'react'
import { DailyLog } from '@/components/log/daily-log'
import { DatePicker } from '@/components/ui/date-picker'
import { ScrollToTop } from '@/components/ui/scroll-to-top'

export default function LogPage() {
  useEffect(() => { document.title = 'Daily Log — MLB Research' }, [])
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Daily MLB Log</h1>
        <div className="flex items-center gap-1.5">
          <DatePicker value={startDate} onChange={setStartDate} label="Start date" />
          <span className="text-xs text-muted-foreground">–</span>
          <DatePicker value={endDate} onChange={setEndDate} label="End date" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Every update captured — lineup posts, transactions, injuries, and research notes
      </p>
      <DailyLog startDate={startDate} endDate={endDate} />
      <ScrollToTop />
    </div>
  )
}
