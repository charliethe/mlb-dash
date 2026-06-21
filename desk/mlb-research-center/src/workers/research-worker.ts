/**
 * MLB Research Worker
 *
 * Standalone worker that calls the /api/worker route to sync games, transactions,
 * news, and generate daily log entries.
 *
 * Run via cron every 5-10 minutes:
 *   npx tsx src/workers/research-worker.ts
 *
 * Crontab (every 10 min):
 *   cd /path/to/project && npx tsx src/workers/research-worker.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

async function run() {
  console.log(`[MLB Worker] Starting cycle at ${new Date().toISOString()}`)

  try {
    const res = await fetch(`${BASE_URL}/api/worker`, {
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[MLB Worker] API returned ${res.status}: ${text}`)
      process.exit(1)
    }

    const data = await res.json()
    if (data.success) {
      console.log(`[MLB Worker] Cycle complete`)
      for (const result of data.results || []) {
        console.log(`  - ${result}`)
      }
    } else {
      console.error(`[MLB Worker] Cycle failed: ${data.error}`)
      process.exit(1)
    }
  } catch (err) {
    console.error(`[MLB Worker] Error:`, err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

run()
