/**
 * Verifies Stripe-related env vars and (when possible) calls Stripe APIs.
 * Does not print secret values — only SET/MISSING and public metadata.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadDotEnvFile(name) {
  const p = path.join(root, name)
  if (!fs.existsSync(p)) return false
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
  return true
}

const loadedLocal = loadDotEnvFile('.env.local')
const loadedEnv = loadDotEnvFile('.env')

function status(key) {
  const v = process.env[key]
  const ok = v != null && String(v).trim().length > 0
  return ok ? `SET (${String(v).trim().length} chars)` : 'MISSING'
}

const keys = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_ENTERPRISE_PRICE_ID',
]

console.log('Env files loaded: .env.local=' + loadedLocal + ', .env=' + loadedEnv)
console.log('')
for (const k of keys) {
  console.log(k + ': ' + status(k))
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim()
if (appUrl) {
  const looksOk = /^https?:\/\//i.test(appUrl)
  console.log('')
  console.log('NEXT_PUBLIC_APP_URL format: ' + (looksOk ? 'OK (http/https)' : 'WARN (expected http/https URL)'))
  if (appUrl.endsWith('/')) {
    console.log('NEXT_PUBLIC_APP_URL: WARN (trailing slash — checkout route strips it, but prefer no trailing slash)')
  }
}

const sk = process.env.STRIPE_SECRET_KEY?.trim()
const proId = process.env.STRIPE_PRO_PRICE_ID?.trim()
const entId = process.env.STRIPE_ENTERPRISE_PRICE_ID?.trim()

if (!sk) {
  console.log('\nSkip Stripe API checks (no STRIPE_SECRET_KEY).')
  process.exit(loadedLocal || loadedEnv ? 0 : 1)
}

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })

async function checkPrice(label, id) {
  if (!id) {
    console.log('\n' + label + ': MISSING id')
    return false
  }
  try {
    const p = await stripe.prices.retrieve(id)
    const active = p.active ? 'active' : 'inactive'
    const type = p.type || '?'
    const recurring = p.recurring
      ? p.recurring.interval + (p.recurring.interval_count > 1 ? ` x${p.recurring.interval_count}` : '')
      : 'one_time'
    const amount = p.unit_amount != null ? (p.unit_amount / 100).toFixed(2) + ' ' + String(p.currency || '').toUpperCase() : 'n/a'
    console.log('\n' + label + ' (' + id + '): OK')
    console.log('  Stripe: ' + active + ', type=' + type + ', ' + recurring + ', unit=' + amount)
    if (p.type === 'one_time') {
      console.log('  WARN: Checkout uses subscription mode — price should be recurring.')
    }
    if (!p.active) console.log('  WARN: price is not active in Stripe')
    return true
  } catch (e) {
    console.log('\n' + label + ' (' + id + '): FAIL')
    console.log('  ' + (e && e.message ? e.message : String(e)))
    return false
  }
}

console.log('\n--- Stripe API (live call) ---')

let ok = true
ok = (await checkPrice('STRIPE_PRO_PRICE_ID', proId)) && ok
ok = (await checkPrice('STRIPE_ENTERPRISE_PRICE_ID', entId)) && ok

try {
  const hooks = await stripe.webhookEndpoints.list({ limit: 20 })
  console.log('\nWebhook endpoints in this Stripe account (first 20):')
  if (!hooks.data.length) {
    console.log('  (none — add one in Dashboard → Developers → Webhooks pointing to /api/webhooks/stripe)')
  }
  for (const h of hooks.data) {
    const url = h.url || ''
    const ours = url.includes('/api/webhooks/stripe')
    console.log('  - ' + url + (ours ? '  <-- matches app route pattern' : ''))
  }
} catch (e) {
  console.log('\nWebhook list: could not fetch (' + (e && e.message ? e.message : String(e)) + ')')
}

process.exit(ok ? 0 : 1)
