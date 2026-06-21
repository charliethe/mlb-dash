'use client'

import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { useTheme } from 'next-themes'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const { theme } = useTheme()

  return (
    <div className="relative">
      <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-auto min-w-[140px] rounded-md border border-input bg-transparent pl-8 pr-1 text-xs cursor-pointer
          hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
          disabled:cursor-not-allowed disabled:opacity-50
          [&::-webkit-calendar-picker-indicator]:opacity-30 [&::-webkit-calendar-picker-indicator]:hover:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
        aria-label={label || 'Select date'}
      />
    </div>
  )
}

export function formatDateDisplay(dateStr: string): string {
  try {
    return format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d, yyyy')
  } catch {
    return dateStr
  }
}
