/**
 * Apply pending SQL migration files to the remote Postgres used by Supabase.
 * Reads DATABASE_URL, DIRECT_URL, or POSTGRES_URL from .env.local (first match wins).
 *
 * Usage: node scripts/db-apply-pending.mjs
 *
 * Requires: npm install pg (devDependency)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return {}
  const raw = fs.readFileSync(p, 'utf8')
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

const env = { ...process.env, ...loadEnvLocal() }
const url = env.DATABASE_URL || env.DIRECT_URL || env.POSTGRES_URL

const FILES = [
  /* Theme / appearance columns — required for Save brand & theme on the public league editor */
  '20260505110000_league_theme_presets.sql',
  '20260506140000_league_appearance_mode.sql',
  '20260506200000_league_theme_choice_ids.sql',
  '20260507013000_team_manager_news_calendar.sql',
  '20260507120000_league_identity_change_limits.sql',
  '20260507200000_game_starters_shooting.sql',
  '20260508100000_teams_logo_url.sql',
  '20260508210000_player_game_stats_team_id.sql',
  '20260509130000_dropin_waitlist.sql',
  '20260511120000_team_stream_house_rules.sql',
]

async function main() {
  if (!url) {
    console.error(
      'Missing DATABASE_URL (or DIRECT_URL / POSTGRES_URL) in environment or .env.local.\n' +
        'Supabase: Project Settings → Database → Connection string (URI), mode Transaction or Session.'
    )
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    for (const f of FILES) {
      const fp = path.join(root, 'supabase', 'migrations', f)
      if (!fs.existsSync(fp)) {
        console.warn('Skip (missing file):', f)
        continue
      }
      const sql = fs.readFileSync(fp, 'utf8')
      console.log('Applying', f, '...')
      await client.query(sql)
      console.log('OK', f)
    }
  } finally {
    await client.end()
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
