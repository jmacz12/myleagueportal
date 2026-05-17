/**
 * Dev-only: confirm player_game_stats exist for a season (uses .env.local).
 * Run after seed: npm run verify:stats-db
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const envPath = join(process.cwd(), '.env.local')
if (!existsSync(envPath)) {
  console.error('Missing .env.local')
  process.exit(1)
}
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const sb = createClient(url, key)
const slug = process.argv[2] || 'vancouvarites'

async function main() {
  const { data: org } = await sb.from('organizations').select('id, plan').eq('slug', slug).maybeSingle()
  if (!org?.id) {
    console.error(`No org for slug ${slug}`)
    process.exit(1)
  }

  const { data: season } = await sb
    .from('seasons')
    .select('id, name, is_active')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!season?.id) {
    console.error('No season')
    process.exit(1)
  }

  const { data: games } = await sb
    .from('games')
    .select('id, status, home_score, away_score')
    .eq('season_id', season.id)
    .in('status', ['final', 'live'])

  const gameIds = (games ?? []).map((g) => g.id as string)
  const { data: stats } = gameIds.length
    ? await sb.from('player_game_stats').select('game_id, pts, player_id').in('game_id', gameIds)
    : { data: [] }

  const finalIds = new Set((games ?? []).filter((g) => g.status === 'final').map((g) => g.id))
  const finalStats = (stats ?? []).filter((s) => finalIds.has(String(s.game_id)))
  const ptsByPlayer = new Map<string, number>()
  for (const r of finalStats) {
    const pid = String(r.player_id)
    ptsByPlayer.set(pid, (ptsByPlayer.get(pid) ?? 0) + Number(r.pts || 0))
  }

  console.log(`Org: ${slug} (plan: ${org.plan})`)
  console.log(`Season: ${season.name}`)
  console.log(`Live/final games: ${gameIds.length}`)
  console.log(`player_game_stats rows: ${stats?.length ?? 0}`)
  console.log(`Players with PTS in finals: ${ptsByPlayer.size}`)

  if (gameIds.length === 0) {
    console.log('\nNo final/live games — Stats tab will show empty game list until games exist.')
    process.exit(0)
  }

  if ((stats?.length ?? 0) === 0) {
    console.error('\nFAIL: games exist but no stat rows — scoring/import not persisting?')
    process.exit(1)
  }

  const top = [...ptsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0]
  console.log(`Top scorer sample: player ${top?.[0]} → ${top?.[1]} PTS`)
  console.log('\nDB check passed — Stats hub should show leaders + View box score when logged in as owner.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
