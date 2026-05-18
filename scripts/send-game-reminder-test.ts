/**
 * One-off: send a real game reminder to a test email for vancouvarites.
 * Run: npx tsx scripts/send-game-reminder-test.ts
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runGameReminders } from '../lib/run-game-reminders'

const TEST_EMAIL = process.env.TEST_EMAIL?.trim() || process.argv[2]?.trim()
const SLUG = process.env.TEST_LEAGUE_SLUG?.trim() || process.argv[3]?.trim() || 'vancouvarites'

if (!TEST_EMAIL) {
  console.error('Usage: TEST_EMAIL=you@example.com npx tsx scripts/send-game-reminder-test.ts')
  console.error('   or: npx tsx scripts/send-game-reminder-test.ts you@example.com [slug]')
  process.exit(1)
}

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

async function main() {
  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .select('id, name, slug, plan, game_email_reminders_enabled')
    .eq('slug', SLUG)
    .single()

  if (orgErr || !org) {
    console.error('Org not found:', orgErr?.message)
    process.exit(1)
  }

  await sb
    .from('organizations')
    .update({ game_email_reminders_enabled: true })
    .eq('id', org.id)

  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: games } = await sb
    .from('games')
    .select('id, home_team_id, away_team_id, status')
    .eq('organization_id', org.id)
    .eq('status', 'scheduled')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .limit(1)

  let gameId = games?.[0]?.id as string | undefined
  const homeId = games?.[0]?.home_team_id as string | undefined
  const awayId = games?.[0]?.away_team_id as string | undefined

  if (!gameId || !homeId || !awayId) {
    console.error('No scheduled game with both teams found for', SLUG)
    process.exit(1)
  }

  await sb
    .from('games')
    .update({
      scheduled_at: scheduledAt,
      location: 'Community gym — Court 1 (test reminder)',
    })
    .eq('id', gameId)

  const teamId = homeId
  const { data: players } = await sb
    .from('players')
    .select('id, full_name, email')
    .eq('organization_id', org.id)
    .eq('team_id', teamId)
    .limit(1)

  const player = players?.[0]
  if (!player?.id) {
    console.error('No player on home team')
    process.exit(1)
  }

  await sb
    .from('players')
    .update({
      email: TEST_EMAIL,
      game_reminders_opt_out: false,
    })
    .eq('id', player.id)

  await sb.from('game_reminder_sends').delete().eq('game_id', gameId).eq('player_id', player.id)

  console.log('Prepared test:')
  console.log('  League:', org.name)
  console.log('  Game:', gameId, 'at', scheduledAt)
  console.log('  Player:', player.full_name, '→', TEST_EMAIL)
  console.log('')

  const result = await runGameReminders(sb, { dryRun: false })
  console.log(JSON.stringify(result, null, 2))

  if (result.emailsSent < 1 || result.errors.length) {
    process.exit(1)
  }
  console.log('\nCheck inbox:', TEST_EMAIL, '(and spam/junk)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
