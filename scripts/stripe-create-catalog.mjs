/**
 * Create MyLeaguePortal Pro + Enterprise products/prices in Stripe (test or live).
 *
 *   node scripts/stripe-create-catalog.mjs           # uses STRIPE_SECRET_KEY (test)
 *   node scripts/stripe-create-catalog.mjs --live    # uses STRIPE_LIVE_SECRET_KEY or sk_live STRIPE_SECRET_KEY
 *
 * Prints lines to paste into .env.local / Vercel.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

loadEnv()

const useLive = process.argv.includes('--live')
const currency = (process.argv.find((a) => a.startsWith('--currency='))?.slice(11) || 'cad').toLowerCase()

const sk = (
  useLive
    ? process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY
)?.trim()

if (!sk) {
  console.error('Missing STRIPE_SECRET_KEY in .env.local')
  process.exit(1)
}

const mode = sk.startsWith('sk_live') ? 'LIVE' : sk.startsWith('sk_test') ? 'TEST' : '?'
if (useLive && mode !== 'LIVE') {
  console.error('--live requires sk_live_... (set STRIPE_LIVE_SECRET_KEY in .env.local)')
  process.exit(1)
}

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })

const catalog = [
  {
    plan: 'pro',
    productName: 'MyLeaguePortal Pro',
    description: 'Pro plan — custom branding, schedule import, live scoring, game reminders.',
    unitAmount: 4900,
  },
  {
    plan: 'enterprise',
    productName: 'MyLeaguePortal Enterprise',
    description: 'Enterprise plan — unlimited scale, white-label, multi-admin, full stats.',
    unitAmount: 14900,
  },
]

console.log(`Stripe mode: ${mode}`)
console.log(`Currency: ${currency.toUpperCase()}\n`)

const out = {}

for (const item of catalog) {
  const product = await stripe.products.create({
    name: item.productName,
    description: item.description,
    metadata: { mlp_plan: item.plan },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency,
    unit_amount: item.unitAmount,
    recurring: { interval: 'month' },
    metadata: { mlp_plan: item.plan },
  })

  out[item.plan] = price.id
  console.log(`Created ${item.productName}`)
  console.log(`  product: ${product.id}`)
  console.log(`  price:   ${price.id}  (${item.unitAmount / 100} ${currency.toUpperCase()}/mo)\n`)
}

console.log('--- Paste into .env.local ---\n')
if (mode === 'LIVE') {
  console.log(`STRIPE_LIVE_PRO_PRICE_ID=${out.pro}`)
  console.log(`STRIPE_LIVE_ENTERPRISE_PRICE_ID=${out.enterprise}`)
  console.log(`STRIPE_PRO_PRICE_ID=${out.pro}`)
  console.log(`STRIPE_ENTERPRISE_PRICE_ID=${out.enterprise}`)
} else {
  console.log(`STRIPE_PRO_PRICE_ID=${out.pro}`)
  console.log(`STRIPE_ENTERPRISE_PRICE_ID=${out.enterprise}`)
}
