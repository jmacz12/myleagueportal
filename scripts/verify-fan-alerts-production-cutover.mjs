/**
 * Production cutover checks for fan email alerts (round 1 + round 2).
 * Run: npm run verify:fan-alerts-production
 *
 * Requires .env.local with DATABASE_URL (production Supabase) and optional CRON_SECRET.
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
const cronSecret = process.env.CRON_SECRET?.trim()
const prodSite = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myleagueportal.com').replace(/\/$/, '')

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key)

const ROUND2_ORG_COLS = [
  'fan_email_news_publish_enabled',
  'fan_email_stats_highlights_enabled',
]
const ROUND2_PLAYER_COLS = ['fan_email_news_publish_opt_out', 'fan_email_stats_highlights_opt_out']
const ROUND2_TABLES = [
  'league_site_news_email_sends',
  'team_news_email_sends',
  'stats_highlight_email_sends',
]

async function columnExists(table, column) {
  const { error } = await sb.from(table).select(column).limit(1)
  if (!error) return true
  const msg = String(error.message || '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('schema cache')) return false
  return true
}

async function tableReadable(name) {
  const { error } = await sb.from(name).select('id').limit(1)
  return !error
}

async function main() {
  const report = {
    supabaseUrl: url.replace(/https:\/\/([^.]+)\..*/, 'https://$1.***.supabase.co'),
    prodSite,
    schema: { ok: true, missing: [] },
    resend: { configured: Boolean(process.env.RESEND_API_KEY?.trim()) },
    cronDryRun: null,
    liveSettingsPage: null,
  }

  for (const col of ROUND2_ORG_COLS) {
    const ok = await columnExists('organizations', col)
    if (!ok) {
      report.schema.ok = false
      report.schema.missing.push(`organizations.${col}`)
    }
  }
  for (const col of ROUND2_PLAYER_COLS) {
    const ok = await columnExists('players', col)
    if (!ok) {
      report.schema.ok = false
      report.schema.missing.push(`players.${col}`)
    }
  }
  for (const t of ROUND2_TABLES) {
    const ok = await tableReadable(t)
    if (!ok) {
      report.schema.ok = false
      report.schema.missing.push(`table ${t}`)
    }
  }

  {
    const { error } = await sb.from('league_site_content').select('published_at').limit(1)
    if (error) {
      const msg = String(error.message || '').toLowerCase()
      if (msg.includes('does not exist') || msg.includes('schema cache')) {
        report.schema.ok = false
        report.schema.missing.push('league_site_content.published_at')
      }
    }
  }

  if (cronSecret) {
    try {
      const res = await fetch(`${prodSite}/api/cron/game-reminders?dry_run=1`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const body = await res.json().catch(() => ({}))
      report.cronDryRun = {
        httpStatus: res.status,
        ok: res.ok,
        leagueNews: body.leagueNews ?? null,
        statsHighlights: body.statsHighlights ?? null,
        errors: [
          ...(body.gameReminders?.errors ?? []),
          ...(body.registrationOpens?.errors ?? []),
          ...(body.dropinReminders?.errors ?? []),
          ...(body.leagueNews?.errors ?? []),
          ...(body.statsHighlights?.errors ?? []),
        ],
      }
    } catch (e) {
      report.cronDryRun = { ok: false, error: String(e) }
    }
  } else {
    report.cronDryRun = { skipped: 'CRON_SECRET not in .env.local' }
  }

  try {
    const res = await fetch(`${prodSite}/`, { redirect: 'follow' })
    report.liveSettingsPage = { homeHttpStatus: res.status, ok: res.ok }
  } catch (e) {
    report.liveSettingsPage = { ok: false, error: String(e) }
  }

  console.log(JSON.stringify(report, null, 2))

  const failed =
    !report.schema.ok ||
    (report.cronDryRun && report.cronDryRun.ok === false) ||
    (report.liveSettingsPage && report.liveSettingsPage.ok === false)

  if (failed) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
