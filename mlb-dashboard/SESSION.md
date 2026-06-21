# Session — Jun 5, 2026

## Done
- ✅ **Team colors namespaced by sport** — `TEAM_COLORS.mlb/nba/nfl/nhl`, `teamColor()` takes sport param
- ✅ **Rate limit middleware registered** — 60 req/min per IP via `app.add_middleware(RateLimitMiddleware)`
- ✅ **Line movement arrows fixed** — `previousOdds[key]` stored after comparison, arrows show on every diff
- ✅ **`.gitignore`** — pycache, .env, bet_history.json, .DS_Store, IDE files
- ✅ **Docker volume crash fixed** — mounts `./backend/data/` dir instead of file; tracker auto-creates the file
- ✅ **Non-MLB sports labeled** — "ODDS ONLY" badge on game cards, notice in detail modal
- ✅ **Exponential backoff on API failure** — base 2min, doubles to 32min max, resets on success
- ✅ **Favicon + meta tags** — emoji favicon, description, theme-color
- ✅ **Void confirmation labeled** — shows matchup/bet/side in confirm dialog
- ✅ **Loading states per tab** — picks/tracking tabs show loading indicator if no data
- ✅ **Trends tab** — bankroll SVG chart, bet-type bars, confidence bars, last-20 result bars
- ✅ **2min auto-refresh** (was 60s), 30s stale check (was 15s)
- ✅ **30-min bet settlement cooldown** — only resolve "Final" games started >3hrs ago
- ✅ **Retry logic** — `_fetch_json` retries twice with 1s sleep
- ✅ **Logging** — `print()` → `logging.getLogger`, configured at startup
- ✅ **`res.ok` check** — void fetch guards against non-JSON error responses
- ✅ **`.env` support** — `start.sh` auto-sources `.env` from project root
- ✅ **Health endpoint** — reports `odds_api_configured`, `tracked_picks`
- ✅ **O/U variety fixed** — calculated from actual RS/RA per game (range 8.0–9.8), no longer always 10.5
- ✅ **Reasoning improved** — shows actual run diff numbers, records, venue descriptions

## Remaining
- **Odds API key** — set `ODDS_API_KEY` in `.env` for real sportsbook lines (vs calculated)
- **Non-MLB stats** — NBA/NFL/NHL still odds-only (no free team stats API integrated)
- **PWA / mobile** — no service worker, no installable app
- **Multiple bookmakers** — only uses first bookmaker from Odds API

## Key Files
- `backend/data_fetcher.py` — `_calc_odds` now accepts stat dicts for real O/U calc; `_fetch_json` has retry
- `backend/bet_tracker.py` — 30min settlement cooldown; logging instead of print
- `backend/smart_analyzer.py` — richer reasoning with actual run diff/record/venue data
- `frontend/app.js` — trends tab, backoff, team colors by sport, venue badge, odds-only badge
- `frontend/styles.css` — trends, venue, odds-only styles
- `start.sh` — .env support, no hardcoded key
- `.gitignore` — new
