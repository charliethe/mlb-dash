'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Save, Check, Moon, Sun } from 'lucide-react'
import { ScrollToTop } from '@/components/ui/scroll-to-top'
import { ErrorBoundary } from '@/components/ui/error-boundary'

function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { console.warn('Failed to save setting to localStorage') }
  }, [key, value])
  return [value, setValue]
}

export default function SettingsPage() {
  useEffect(() => { document.title = 'Settings — MLB Research' }, [])
  const [mlbEnabled, setMlbEnabled] = useLocalStorage('settings-mlb-enabled', true)
  const [espnEnabled, setEspnEnabled] = useLocalStorage('settings-espn-enabled', true)
  const [foxEnabled, setFoxEnabled] = useLocalStorage('settings-fox-enabled', false)
  const [saved, setSaved] = useState(false)
  const { theme, setTheme } = useTheme()

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <ErrorBoundary name="Settings">
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Dark or light mode</p>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  theme === 'dark' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  theme === 'light' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">MLB.com News</p>
              <p className="text-xs text-muted-foreground">Official MLB news and RSS feed</p>
            </div>
            <Switch checked={mlbEnabled} onCheckedChange={setMlbEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">ESPN MLB News</p>
              <p className="text-xs text-muted-foreground">ESPN MLB headlines API</p>
            </div>
            <Switch checked={espnEnabled} onCheckedChange={setEspnEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">FOX Sports MLB</p>
              <p className="text-xs text-muted-foreground">FOX Sports MLB news feed</p>
            </div>
            <Switch checked={foxEnabled} onCheckedChange={setFoxEnabled} />
          </div>
          <Button onClick={handleSave} className="h-8 text-xs gap-1" variant={saved ? 'default' : 'outline'}>
            {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? 'Saved' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Background Worker</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run the research worker every 5-10 minutes to automatically sync games, transactions, news, and alerts.
          </p>
          <div className="mt-2 p-2 bg-muted/30 rounded-md">
            <code className="text-xs font-mono">npx tsx src/workers/research-worker.ts</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Add to crontab: <code className="font-mono">*/10 * * * * cd /path/to/project && npx tsx src/workers/research-worker.ts</code>
          </p>
        </CardContent>
      </Card>
    </div>
      <ScrollToTop />
    </ErrorBoundary>
  )
}
