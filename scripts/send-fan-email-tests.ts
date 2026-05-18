/**
 * Send fan email test samples to an inbox (uses Resend from .env.local).
 * Run: npx tsx scripts/send-fan-email-tests.ts jhm_q12@outlook.com league_news team_news stats_highlight
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FAN_EMAIL_TEST_KINDS,
  buildFanEmailTestMessage,
  isFanEmailTestKind,
  type FanEmailTestKind,
} from '../lib/fan-email-test'
import { resolveResendFromAddress } from '../lib/email/resend-from'
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '../lib/email/send-transactional'

const envPath = join(process.cwd(), '.env.local')
if (!existsSync(envPath)) {
  console.error('Missing .env.local')
  process.exit(1)
}
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const to = process.argv[2]?.trim().toLowerCase()
const kindArgs = process.argv.slice(3)
const kinds: FanEmailTestKind[] =
  kindArgs.length > 0
    ? kindArgs.filter(isFanEmailTestKind)
    : (['league_news', 'team_news', 'stats_highlight'] as FanEmailTestKind[])

if (!to || !to.includes('@')) {
  console.error(
    `Usage: npx tsx scripts/send-fan-email-tests.ts <email> [${FAN_EMAIL_TEST_KINDS.join(' ')}]`
  )
  process.exit(1)
}

if (kinds.length === 0) {
  console.error('No valid kinds. Options:', FAN_EMAIL_TEST_KINDS.join(', '))
  process.exit(1)
}

if (!isEmailDeliveryConfigured()) {
  console.error('Email not configured (RESEND_API_KEY / RESEND_FROM)')
  process.exit(1)
}

const slug = process.env.FAN_EMAIL_TEST_LEAGUE_SLUG?.trim() || 'vancouvarites'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

async function main() {
  const sb = createClient(url!, key!)
  let { data: org } = await sb
    .from('organizations')
    .select('name, slug, league_timezone, custom_domain, custom_domain_verified_at')
    .eq('slug', slug)
    .maybeSingle()

  if (!org) {
    const fallback = await sb
      .from('organizations')
      .select('name, slug, league_timezone, custom_domain, custom_domain_verified_at')
      .limit(1)
      .maybeSingle()
    org = fallback.data
    if (org) console.warn(`Slug "${slug}" not found; using "${org.slug}"`)
  }

  const verifiedDomain =
    org?.custom_domain_verified_at && org?.custom_domain?.trim()
      ? org.custom_domain.trim().toLowerCase()
      : null

  const orgCtx = {
    leagueName: String(org?.name || 'MyLeaguePortal Sample League'),
    leagueSlug: String(org?.slug || slug),
    leagueTimezone: org?.league_timezone ?? 'America/Vancouver',
    verifiedCustomDomain: verifiedDomain,
  }

  if (!org) {
    console.warn('No organization in database — using sample league branding for test emails.')
  }

  const from = resolveResendFromAddress()
  if (from) {
    process.env.RESEND_FROM = from
    console.log('Using sender:', from)
  }

  const sent: string[] = []
  const errors: string[] = []

  for (const kind of kinds) {
    const mail = buildFanEmailTestMessage(kind, orgCtx)
    const res = await sendTransactionalEmail({ to, subject: mail.subject, html: mail.html, text: mail.text })
    if (!res.ok) {
      errors.push(`${kind}: ${res.error}`)
    } else if (res.skipped) {
      errors.push(`${kind}: skipped (${res.reason})`)
    } else {
      sent.push(kind)
      console.log(`Sent ${kind} → ${to}`)
    }
  }

  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(sent.length ? 0 : 1)
  }

  console.log('Done:', sent.join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
