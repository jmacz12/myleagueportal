/**
 * Refresh the demo LIVE game + stream URL for a league (Stream tab testing).
 *
 *   npx tsx scripts/seed-live-stream-demo.ts --slug=vancouvarites
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { ensureLiveStreamDemoGame } from '../lib/ensure-live-stream-demo'

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

function parseSlug(argv: string[]): string | undefined {
  for (const a of argv) {
    if (a.startsWith('--slug=')) return a.slice('--slug='.length).trim() || undefined
  }
  return undefined
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const appOrigin = env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).')
    process.exit(1)
  }

  const slug = parseSlug(process.argv.slice(2)) || env.SEED_LEAGUE_SLUG?.trim()
  if (!slug) {
    console.error('Usage: npx tsx scripts/seed-live-stream-demo.ts --slug=your-league-slug')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const { data: org, error: orgErr } = await supabase.from('organizations').select('id').eq('slug', slug).single()

  if (orgErr || !org?.id) {
    console.error(`No organization with slug "${slug}":`, orgErr?.message || 'not found')
    process.exit(1)
  }

  const result = await ensureLiveStreamDemoGame(supabase, org.id)
  if (!result.ok) {
    console.error(result.error)
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        gameId: result.gameId,
        homeTeam: result.homeTeam,
        awayTeam: result.awayTeam,
        created: result.created,
        urls: {
          leagueStreamTab: `${appOrigin.replace(/\/$/, '')}/league/${slug}?tab=stream`,
          leagueStreamGame: `${appOrigin.replace(/\/$/, '')}/league/${slug}?tab=stream&game=${result.gameId}`,
        },
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
