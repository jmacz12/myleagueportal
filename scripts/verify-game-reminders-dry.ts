/**
 * Dry-run game reminder job (no emails sent). Needs .env.local + Supabase.
 * Run: npm run verify:game-reminders
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runGameReminders } from '../lib/run-game-reminders'
import { isEmailDeliveryConfigured } from '../lib/email/send-transactional'

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
  console.log('Email configured:', isEmailDeliveryConfigured())
  const result = await runGameReminders(sb, { dryRun: true })
  console.log(JSON.stringify(result, null, 2))
  if (result.errors.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
