/**
 * Fix live Stripe webhook URL + print Vercel env instructions.
 * Reads STRIPE_LIVE_SECRET_KEY or sk_live_ in STRIPE_SECRET_KEY from .env.local
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env.local')

function loadEnv() {
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

loadEnv()

const CANONICAL = 'https://www.myleagueportal.com/api/webhooks/stripe'
const sk =
  process.env.STRIPE_LIVE_SECRET_KEY?.trim() ||
  (process.env.STRIPE_SECRET_KEY?.trim()?.startsWith('sk_live_') ? process.env.STRIPE_SECRET_KEY.trim() : '')

if (!sk) {
  console.log('NO_LIVE_KEY')
  process.exit(2)
}

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })
const hooks = await stripe.webhookEndpoints.list({ limit: 100 })
const ours = hooks.data.filter((h) => (h.url || '').includes('/api/webhooks/stripe'))

console.log('Live webhooks for /api/webhooks/stripe:', ours.length)
for (const h of ours) {
  console.log('  id:', h.id)
  console.log('  url:', h.url)
  console.log('  status:', h.status)
  console.log('  events:', (h.enabled_events || []).join(', '))
}

const target =
  ours.find((h) => h.url === CANONICAL) ||
  ours.find((h) => h.url?.includes('myleagueportal')) ||
  ours[0]

if (!target) {
  console.log('CREATE_NEEDED')
  const created = await stripe.webhookEndpoints.create({
    url: CANONICAL,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ],
    description: 'MyLeaguePortal Production',
  })
  console.log('CREATED', created.id)
  console.log('WEBHOOK_SECRET_FOR_VERCEL=' + created.secret)
  process.exit(0)
}

const needEvents = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]
const missing = needEvents.filter((e) => !target.enabled_events?.includes(e) && target.enabled_events?.[0] !== '*')
const urlWrong = target.url !== CANONICAL

if (urlWrong || missing.length) {
  const updated = await stripe.webhookEndpoints.update(target.id, {
    url: CANONICAL,
    enabled_events: needEvents,
    description: target.description || 'MyLeaguePortal Production',
  })
  console.log('UPDATED', updated.id)
  console.log('  new url:', updated.url)
} else {
  console.log('ALREADY_OK', target.id)
}

console.log('')
console.log('Signing secret: open Stripe → this endpoint → Reveal (not returned by update API).')
console.log('Vercel: set STRIPE_WEBHOOK_SECRET on Production, then redeploy.')
