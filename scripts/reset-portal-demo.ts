/**
 * Reset portal demo: 10 teams, Summer 2026, light schedule, Mon/Wed drop-ins.
 *
 *   npx tsx scripts/reset-portal-demo.ts --slug=vancouvarites
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvLocal(): Record<string, string> {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return {}
  const raw = fs.readFileSync(p, 'utf8')
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

async function main() {
  const slug =
    process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length).trim() ||
    loadEnvLocal().SEED_LEAGUE_SLUG?.trim() ||
    'vancouvarites'

  const base = process.env.DEV_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${base}/api/dev/seed-teams-players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug,
      replace: true,
      fullPortalDemo: true,
      withGamesAndStats: true,
      previewPublicTier: 'enterprise',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Reset failed:', data.error || res.statusText)
    process.exit(1)
  }

  console.log(data.message || 'Portal demo reset complete.')
  console.log('Season:', data.season_id)
  console.log('Teams:', (data.teams || []).map((t: { name: string }) => t.name).join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
