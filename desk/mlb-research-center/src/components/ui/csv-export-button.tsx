'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface CsvExportButtonProps {
  filename: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
  label?: string
}

export function CsvExportButton({ filename, headers, rows, label = 'CSV' }: CsvExportButtonProps) {
  function handleExport() {
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => {
          if (cell == null) return ''
          const str = String(cell)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename.replace(/[^a-zA-Z0-9-_]/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
      <Download className="h-3 w-3" />
      {label}
    </Button>
  )
}
