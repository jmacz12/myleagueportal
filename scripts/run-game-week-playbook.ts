/**
 * Run game-week playbook checks + setup for a demo league (service role).
 * Usage: npx tsx scripts/run-game-week-playbook.ts --slug=vancouvarites
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  DEMO_LIVE_LOCATION,
  DEMO_STREAM_WATCH_URL,
  ensureLiveStreamDemoGame,
} from '../lib/ensure-live-stream-demo'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal(): Record<string, string> {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

function parseSlug(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith('--slug='))
  return flag?.slice(7).trim() || process.env.SEED_LEAGUE_SLUG?.trim() || 'vancouvarites'
}

function log(step: string, detail: string) {
  console.log(`\n[${step}] ${detail}`)
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const slug = parseSlug(process.argv.slice(2))
  const fanOrigin = env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() || 'https://www.myleagueportal.com'

  if (!url || !key) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }

  const sb = createClient(url, key)

  log('1/6', `Loading league "${slug}"…`)
  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .select('id, name, slug, plan, game_email_reminders_enabled, default_stream_url')
    .eq('slug', slug)
    .single()

  if (orgErr || !org) {
    console.error('League not found:', orgErr?.message)
    process.exit(1)
  }

  log('1/6', `Found "${org.name}" (plan: ${org.plan})`)
  console.log(`   Fan URL: ${fanOrigin}/league/${slug}`)

  const { data: seasons } = await sb
    .from('seasons')
    .select('id, name, is_active')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const activeSeason = seasons?.find((s) => s.is_active) ?? seasons?.[0]
  if (!activeSeason) {
    console.error('No season found')
    process.exit(1)
  }

  const { data: scheduled } = await sb
    .from('games')
    .select('id, scheduled_at, status, home_team_id, away_team_id, location')
    .eq('organization_id', org.id)
    .eq('season_id', activeSeason.id)
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(8)

  log('2/6', `Upcoming scheduled games: ${scheduled?.length ?? 0}`)
  for (const g of scheduled ?? []) {
    console.log(`   · ${g.scheduled_at?.slice(0, 16)} — ${g.location ?? 'TBD'} (${g.id.slice(0, 8)}…)`)
  }

  if ((scheduled?.length ?? 0) < 3) {
    log('2/6', 'Adding a few upcoming games…')
    const { data: teams } = await sb
      .from('teams')
      .select('id, name, season_id')
      .eq('organization_id', org.id)
      .eq('season_id', activeSeason.id)
      .order('name')
      .limit(6)

    const rows: Record<string, unknown>[] = []
    for (let u = 0; u < 4 && teams && teams.length >= 2; u++) {
      const home = teams[(u * 2) % teams.length]
      const away = teams[(u * 2 + 1) % teams.length]
      if (home.id === away.id) continue
      const when = new Date()
      when.setDate(when.getDate() + 2 + u)
      when.setHours(19, 30, 0, 0)
      rows.push({
        organization_id: org.id,
        season_id: activeSeason.id,
        home_team_id: home.id,
        away_team_id: away.id,
        scheduled_at: when.toISOString(),
        status: 'scheduled',
        location: 'Community gym — Court 1',
      })
    }
    if (rows.length) {
      const { error: insErr } = await sb.from('games').insert(rows)
      if (insErr) console.warn('   Insert warning:', insErr.message)
      else console.log(`   Added ${rows.length} games`)
    }
  } else {
    log('2/6', 'Schedule already loaded — skipping import')
  }

  log('3/6', 'Stream setup (YouTube URL on org + live demo game)…')
  await sb
    .from('organizations')
    .update({ default_stream_url: DEMO_STREAM_WATCH_URL })
    .eq('id', org.id)

  const live = await ensureLiveStreamDemoGame(sb, org.id)
  if (!live.ok) {
    console.error('   Live demo failed:', live.error)
    process.exit(1)
  }
  console.log(`   Live: ${live.awayTeam} @ ${live.homeTeam} (game ${live.gameId})`)
  console.log(`   Stream tab: ${fanOrigin}/league/${slug}?tab=stream&game=${live.gameId}`)

  log('4/6', 'Enabling game reminder emails on league…')
  await sb.from('organizations').update({ game_email_reminders_enabled: true }).eq('id', org.id)

  const reminderAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const reminderGame = scheduled?.[0]
  if (reminderGame?.id) {
    await sb
      .from('games')
      .update({ scheduled_at: reminderAt.toISOString() })
      .eq('id', reminderGame.id)
      .neq('location', DEMO_LIVE_LOCATION)
    console.log(`   Next reminder candidate game ${reminderGame.id.slice(0, 8)}… → ~24h from now`)
  }

  log('5/6', 'Finalizing one completed game for standings (if none recent)…')
  const { data: finals } = await sb
    .from('games')
    .select('id')
    .eq('organization_id', org.id)
    .eq('status', 'final')
    .limit(1)

  if (!finals?.length && scheduled && scheduled.length >= 2) {
    const toFinal = scheduled[scheduled.length - 1]
    const { data: teams } = await sb.from('teams').select('id').in('id', [toFinal.home_team_id, toFinal.away_team_id].filter(Boolean) as string[])
    if (teams?.length === 2) {
      await sb
        .from('games')
        .update({
          status: 'final',
          home_score: 78,
          away_score: 72,
          scheduled_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', toFinal.id)
      console.log(`   Marked game ${toFinal.id.slice(0, 8)}… as final 78–72`)
    }
  } else {
    console.log(`   Standings already have final games (${finals?.length ?? 0}+)`)
  }

  log('6/6', 'Playbook setup complete')
  console.log('\n--- Check in browser ---')
  console.log(`Schedule:  ${fanOrigin}/league/${slug}?tab=schedule`)
  console.log(`Stream:    ${fanOrigin}/league/${slug}?tab=stream&game=${live.gameId}`)
  console.log(`Standings: ${fanOrigin}/league/${slug}?tab=standings`)
  console.log(`Dashboard: ${fanOrigin}/dashboard/games`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
