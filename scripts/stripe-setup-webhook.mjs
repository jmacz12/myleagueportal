/**
 * Create (or reuse) Stripe webhook for /api/webhooks/stripe.
 * Prints signing secret for STRIPE_WEBHOOK_SECRET — add to .env.local or Vercel.
 *
 * Usage:
 *   node scripts/stripe-setup-webhook.mjs
 *   node scripts/stripe-setup-webhook.mjs --url=https://www.myleagueportal.com/api/webhooks/stripe
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadDotEnvFile(name) {
  const p = path.join(root, name)
  if (!fs.existsSync(p)) return false
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val
  }
  return true
}

const envFileArg = process.argv.find((a) => a.startsWith('--env-file='))?.slice('--env-file='.length)
if (envFileArg) loadDotEnvFile(envFileArg)
else {
  loadDotEnvFile('.env.local')
  loadDotEnvFile('.env')
}

const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length)
const defaultApp = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.myleagueportal.com').replace(/\/$/, '')
const webhookUrl = urlArg || `${defaultApp}/api/webhooks/stripe`

const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

const useLive = process.argv.includes('--live')
const sk = (
  useLive ? process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY : process.env.STRIPE_SECRET_KEY
)?.trim()
if (!sk) {
  console.error(
    useLive
      ? 'Set STRIPE_LIVE_SECRET_KEY (sk_live_...) in .env.local for --live, then run again.'
      : 'Set STRIPE_SECRET_KEY in .env.local (or pass --env-file=).'
  )
  process.exit(1)
}
if (useLive && !sk.startsWith('sk_live_')) {
  console.error('--live requires sk_live_... in STRIPE_LIVE_SECRET_KEY (not test keys).')
  process.exit(1)
}

const mode = sk.startsWith('sk_test_') ? 'TEST' : sk.startsWith('sk_live_') ? 'LIVE' : '?'
console.log(`Stripe mode: ${mode}`)
console.log(`Webhook URL: ${webhookUrl}\n`)

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })

const existing = await stripe.webhookEndpoints.list({ limit: 100 })
const match = existing.data.find((h) => h.url === webhookUrl)

if (match) {
  console.log('Found existing endpoint:', match.id)
  console.log('Status:', match.status)
  console.log('Enabled events:', (match.enabled_events || []).join(', '))
  console.log('')
  console.log('Signing secret is only shown when the endpoint is first created.')
  console.log('If you lost it: Stripe Dashboard → Developers → Webhooks → this endpoint → Reveal signing secret')
  console.log('Or delete this endpoint and run this script again to create a fresh one.')
  process.exit(0)
}

const created = await stripe.webhookEndpoints.create({
  url: webhookUrl,
  enabled_events: EVENTS,
  description: 'MyLeaguePortal billing (checkout + subscription sync)',
})

console.log('Created webhook endpoint:', created.id)
console.log('')
console.log('Add this to Vercel (Production) and .env.local:')
console.log('')
console.log(`STRIPE_WEBHOOK_SECRET=${created.secret}`)
console.log('')
console.log('Then redeploy production on Vercel so game-day billing stays in sync.')
