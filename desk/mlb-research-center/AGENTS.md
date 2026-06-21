## Goal
- Build a full-stack MLB Research Command Center dashboard that monitors rosters, transactions, injuries, lineups, news, and player/team updates using free data sources.

## Constraints & Preferences
- Dark mode, sportsbook/analytics feel, compact data-heavy cards, mobile-friendly, not neon, not a marketing website
- Must use free/free-tier sources first: MLB Stats API, MLB.com RSS, ESPN MLB RSS, FOX Sports MLB RSS
- Do not invent data — if source does not confirm something, show UNKNOWN
- Every news item must include source URL; keep daily log separate from alerts
- Alert importance ranking: high (pitcher scratched, key player out, injury, trade, call-up, postponement), medium (lineup posted, batting order change, roster move), low (recap, preview, quote)
- V1 scope: Today's slate, news feed, transactions feed, team/player watchlist, daily MLB log, important alerts only
- Built with Next.js, Tailwind, shadcn/ui, Supabase, RSS parser, MLB Stats API fetcher
- MLB-StatsAPI is not officially affiliated with MLB

## Progress
### Done
- Created fresh Next.js 16.2.9 project in `/Users/charliekrason/Documents/desk/mlb-research-center` with TypeScript, Tailwind, App Router
- Installed all dependencies including `@supabase/supabase-js`, `@supabase/ssr`, `rss-parser`, `date-fns`, shadcn/ui components
- Created directory structure: `src/types`, `src/lib/supabase`, `src/lib/mlb`, `src/lib/rss`, `src/lib/db`, `src/lib/alerts`, `src/components/layout`, `src/components/dashboard`, `src/components/news`, `src/components/roster`, `src/components/lineup`, `src/components/watchlist`, `src/components/log`, `src/components/alerts`, `src/workers`, `src/hooks`
- Wrote core type definitions in `src/types/index.ts`, MLB constants in `src/lib/mlb/constants.ts`, database schema in `src/lib/db/schema.ts`, alert rules engine in `src/lib/alerts/rules.ts`
- Wrote MLB Stats API layer in `src/lib/mlb/api.ts` (fetchTodayGames, fetchTeamRoster, fetchTransactions, fetchTeams, fetchPlayerInfo, fetchStandings, fetchGameLineup)
- Built all layout components (Sidebar with 11 nav links, TopBar with search+bell)
- Built all dashboard components (TodaySlate, TopUpdates, WatchlistAlerts, DailyLogPreview)
- Built all app pages: Dashboard (`/`), Slate (`/slate`), News (`/news`), Roster (`/roster`), Lineup (`/lineup`), Watchlist (`/watchlist`), Teams (`/teams`), Team Detail (`/teams/[id]`), Log (`/log`), Alerts (`/alerts`), Settings (`/settings`), **Standings (`/standings`)**
- Fixed 15+ TypeScript build errors; current build passes clean with 15 routes (11 static, 4 dynamic)
- Build fixed: `NODE_ENV=production` added to `package.json` build script to work around Next.js 16 `/_global-error` prerendering crash when `NODE_ENV=development` is set in the environment
- Created `@supabase/ssr` utility files: `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/middleware.ts`
- Restructured Supabase client (`src/lib/supabase/client.ts`): `getSupabase()` returns `null` when env vars missing, all data functions gracefully return empty arrays; supports both `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Created server-only admin client at `src/lib/supabase/admin.ts`
- Created `/api/mlb/sync/today` route (fetches MLB Stats API, upserts games to Supabase via service role key)
- Created server-side `/api/news` route (fetches + parses RSS/JSON from MLB.com, ESPN, FOX Sports; returns structured JSON; `rss-parser` runs server-side)
- Rewrote `src/lib/rss/fetcher.ts` to call `/api/news` instead of parsing RSS in-browser (fixes `rss-parser` Node.js dependency in client components)
- Added "Sync Today's MLB Slate" button to dashboard card header
- Fixed all `getSupabase()` null-check TypeScript errors across alert-list, player-watch-card, useData.ts
- Installed Supabase agent skills (`npx skills add supabase/agent-skills`)
- User created Supabase project (ref: `tsvbhaqscezbaogopaph`) and populated `.env.local` with valid publishable/anon and service role keys
- SQL for `games` table created in Supabase; table exists in Postgres but not yet exposed via REST API (schema cache needs manual refresh in Supabase dashboard → Project Settings → API → Refresh schema cache)
- **TodaySlate improved**: team logos, live scores/innings, venue name, team records (W-L), probable pitcher handedness + W-L for all games
- **Quick Stats**: now computed from live MLB API data — games today, live count, transactions today, unread alerts
- **Standings page** (`/standings`): 6 division tables with logos, W-L, Pct, GB, L10, Streak; AL/NL/All filter toggle
- **Sidebar**: added Standings nav link (BarChart3 icon) between Roster Tracker and Lineup Center
- **All 4 dashboard panels**: centered layout (Quick Stats row → TodaySlate+Watchlist → TopUpdates+DailyLog)

### In Progress
- Resolving Supabase REST API visibility: `games` table created in Postgres but PostgREST schema cache hasn't been refreshed; `GRANT USAGE ON SCHEMA public TO anon` and RLS policies applied but REST endpoint still returns "Could not find the table 'public.games' in the schema cache"

### Blocked
- `games` table unavailable via Supabase REST API until schema cache is refreshed (Settings → API → Refresh schema cache button)
- `npm run dev` works perfectly; `npm run build` works with `NODE_ENV=production`

## Key Decisions
- Changed to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY` to match new Supabase dashboard output format (`sb_publishable_*`)
- Moved RSS parsing server-side to `/api/news` because `rss-parser` is a Node.js package that can't run in the browser via dynamic import
- `getSupabase()` returns `null` when env vars missing instead of calling `createClient('', '')` which throws; all callers null-guarded
- Used `NODE_ENV=production next build` in package.json build script to avoid Next.js 16.2.9 bug where `NODE_ENV=development` in the shell environment crashes `/_global-error` prerendering

## Next Steps
1. Refresh Supabase schema cache (Project Settings → API → Refresh schema cache) to make `games` table accessible via REST API
2. Test `/api/mlb/sync/today` endpoint after cache refresh
3. Polish dashboard further: add live scores/innings/venue to TodaySlate — **DONE**
4. Create Standings page (`/standings`) using `fetchStandings()` from MLB API; add sidebar link — **DONE**
5. Improve team detail page with standings + recent games
6. Improve team detail page (`/teams/[id]`) — better layout, add recent games, standings position, visual team info

## Critical Context
- Next.js 16.2.9 has a build-time bug: if `NODE_ENV=development` is set in the shell environment, `/_global-error` prerendering crashes with `useContext null`. Fix: `NODE_ENV=production next build` in package.json.
- MLB Stats API is free, no key required: `https://statsapi.mlb.com/api/v1/...` with `hydrate=probablePitcher,team(leagueRecord),linescore`
- Current MLB season year is 2026
- Supabase project ref: `tsvbhaqscezbaogopaph`; URL: `https://tsvbhaqscezbaogopaph.supabase.co`
- shadcn/ui components use `@base-ui/react` (not Radix) — no `asChild` prop, different Select API (`onValueChange` passes `string | null`), different Tooltip API
- `supabase-js` `createClient('', '')` throws — always check env vars first and return null
- RSS parsing now happens server-side via `/api/news`; client-side `fetchMLBNews()` just calls that endpoint
- Standings page uses `useSearchParams` — wrapped in `<Suspense>` boundary

## Relevant Files
- `src/types/index.ts` — All MLB types (TeamGameInfo has leagueRecord + probablePitcher)
- `src/lib/mlb/constants.ts` — Team IDs/abbreviations/logos, NEWS_SOURCES, MLB_API_BASE; TEAM_LOGOS for all 30 teams
- `src/lib/mlb/api.ts` — MLB Stats API fetcher functions (fetchStandings returns raw division records)
- `src/lib/supabase/client.ts` — Lazy Supabase client (null-returning), all DB access functions
- `src/lib/supabase/admin.ts` — Server-only admin client using `SUPABASE_SERVICE_ROLE_KEY`
- `src/utils/supabase/server.ts` — `@supabase/ssr` createServerClient wrapper
- `src/utils/supabase/client.ts` — `@supabase/ssr` createBrowserClient wrapper
- `src/utils/supabase/middleware.ts` — `@supabase/ssr` middleware client
- `src/app/api/mlb/sync/today/route.ts` — Sync endpoint (MLB API → Supabase games table)
- `src/app/api/news/route.ts` — Server-side RSS/JSON news parser, returns structured JSON
- `src/lib/rss/fetcher.ts` — Client-side fetcher (calls `/api/news`)
- `src/components/dashboard/index.tsx` — 4 dashboard panel components (TodaySlate has sync button, logos, scores, pitchers, venue)
- `src/app/page.tsx` — Dashboard page with live Quick Stats
- `src/app/standings/page.tsx` — Standings page with division tables, wrapped in Suspense
- `src/components/layout/Sidebar.tsx` — 11 nav items including Standings
- `src/app/teams/[id]/page.tsx` — Team detail page
- `.env.local` — Contains real Supabase credentials
- `.env.example` — Template for required env vars
- `package.json` — Build script: `NODE_ENV=production next build`
