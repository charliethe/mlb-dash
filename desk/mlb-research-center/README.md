# MLB Research Center

Full-stack dashboard for monitoring MLB rosters, transactions, injuries, lineups, news, and player/team updates.

Built with Next.js 16, Tailwind CSS v4, shadcn/ui, and free data sources.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Tailwind CSS v4, shadcn/ui (`@base-ui/react`)
- **Data:** MLB Stats API (free, no key), RSS feeds (MLB.com, ESPN, FOX Sports)
- **Persistence:** Supabase (optional), localStorage fallback
- **Testing:** Vitest + Testing Library, Playwright
- **Caching:** LRU in-memory cache with TTL

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in Supabase credentials (optional — app works without Supabase via localStorage fallback).

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build   # uses NODE_ENV=production to avoid dev crash
```

## Test

```bash
npm test          # vitest run
npm run test:watch  # vitest watch mode
```

## Lint

```bash
npm run lint
```

## E2E Tests

```bash
npx playwright install
npx playwright test
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages (34 routes)
│   ├── alerts/             # High/medium/low alert feed
│   ├── compare/            # Side-by-side player comparison
│   ├── game-log/           # Player game-by-game log
│   ├── h2h/                # 30×30 head-to-head matrix
│   ├── milestones/         # Career milestone tracker
│   ├── pitchers/           # Daily starting pitchers
│   ├── postseason/         # Playoff race + magic numbers
│   ├── pythagorean/        # Expected W-L standings
│   ├── scoreboard/         # Inning-by-inning scores
│   ├── season-series/      # H2H season series with streak bar
│   ├── slate/              # Today's games with live refresh
│   └── ...                 # roster, transactions, news, etc.
├── components/             # Shared UI + feature components
│   ├── dashboard/          # Dashboard widgets
│   ├── layout/             # Sidebar, top bar
│   ├── notes/              # Research notes with localStorage
│   ├── ui/                 # shadcn/ui primitives
│   └── watchlist/          # Player watch cards
├── lib/
│   ├── mlb/                # MLB Stats API client + constants
│   ├── rss/                # RSS feed fetcher (MLB.com, ESPN, FOX)
│   ├── supabase/           # Supabase client helpers (safeQuery wrapper)
│   ├── alerts/             # Alert classification rules
│   ├── cache.ts            # LRU in-memory cache with TTL
│   └── settings.ts         # Settings persistence
├── hooks/                  # React hooks (useLocalStorage, etc.)
├── types/                  # TypeScript type definitions
└── __tests__/              # Vitest test files
```

## Key Features

- **Live auto-refresh** on Slate and Scoreboard (30s polling, toggleable)
- **Close game indicators** — 1-Run, Blowout, Tight badges
- **Win probability** — live game win expectancy
- **Career milestones** — real career totals via two-pass API approach
- **Research notes** with localStorage fallback ("Local only" badge)
- **Dark/light toggle** — persistent theme preference
- **Dashboard widgets** — customizable, drag-and-drop layout
- **PWA** — manifest, service worker, install prompt
- **LRU cache** with per-key TTL, rate-limited API fetches (10 req/s)

## Data Sources

| Source | Usage |
|--------|-------|
| `statsapi.mlb.com/api/v1` | Games, standings, rosters, stats, players, schedule |
| `mlb.com/rss` | MLB news feed |
| `espn.com/espn/rss/mlb/news` | ESPN MLB news |
| `foxsports.com/feeds/rs/mlb/rss` | FOX Sports MLB news |
| Open-Meteo API | Weather for ballpark locations |

## Architecture Notes

- All Supabase calls wrapped in `safeQuery` — network errors return fallbacks instead of crashing
- Player search uses cached `/api/v1/sports/1/players` (MLB search API is unreliable)
- Rate limiter: max 10 requests/second, 429 retry with exponential backoff
- Build with `NODE_ENV=production` (Next.js 16.2.9 dev crash on `/_global-error`)
- All state is client-side; no ISR/SSR (appropriate for single-user tool)
