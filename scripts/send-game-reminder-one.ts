/**
 * Send one game reminder sample to a single inbox (no cron, no roster blast).
 * Run: npx tsx scripts/send-game-reminder-one.ts
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGameReminderEmail } from '../lib/game-reminder-email'
import { sendTransactionalEmail } from '../lib/email/send-transactional'

const TO = process.env.TEST_EMAIL?.trim() || process.argv[2]?.trim()
const SLUG = process.env.TEST_LEAGUE_SLUG?.trim() || process.argv[3]?.trim() || 'vancouvarites'

if (!TO) {
  console.error('Usage: TEST_EMAIL=you@example.com npx tsx scripts/send-game-reminder-one.ts')
  console.error('   or: npx tsx scripts/send-game-reminder-one.ts you@example.com [slug]')
  process.exit(1)
}

const envPath = join(process.cwd(), '.env.local')
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const fromCandidates = [
  process.env.RESEND_FROM?.trim(),
  'MyLeaguePortal <reminders@myleagueportal.com>',
  'MyLeaguePortal <reminders@send.myleagueportal.com>',
].filter(Boolean) as string[]

async function main() {
  const { data: org } = await sb
    .from('organizations')
    .select('name, slug, custom_domain, custom_domain_verified_at')
    .eq('slug', SLUG)
    .single()

  if (!org) {
    console.error('Org not found')
    process.exit(1)
  }

  const verifiedDomain =
    org.custom_domain_verified_at && org.custom_domain?.trim()
      ? org.custom_domain.trim().toLowerCase()
      : null

  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const mail = buildGameReminderEmail({
    leagueName: String(org.name || 'Vancouvarites'),
    leagueSlug: SLUG,
    verifiedCustomDomain: verifiedDomain,
    playerName: 'John',
    playerEmail: TO,
    teamName: '[SEED] Blue Notes',
    opponentLabel: '[SEED] Red Hots @ [SEED] Blue Notes',
    scheduledAt,
    location: 'Community gym — Court 1',
    leagueTimezone: null,
  })

  for (const from of fromCandidates) {
    process.env.RESEND_FROM = from
    console.log('Trying from:', from)
    const res = await sendTransactionalEmail({
      to: TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })
    console.log(res)
    if (res.ok && !res.skipped) {
      console.log('\nSent! Check', TO)
      return
    }
  }
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
