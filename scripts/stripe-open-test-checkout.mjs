/**
 * Opens a real Stripe **test mode** Checkout session (subscription) with the same
 * metadata shape as POST /api/stripe/checkout — use this to verify Checkout + webhooks.
 *
 * Requirements:
 *   - STRIPE_SECRET_KEY must start with sk_test_ (refuses live keys)
 *   - STRIPE_PRO_PRICE_ID / STRIPE_ENTERPRISE_PRICE_ID set for test mode
 *   - NEXT_PUBLIC_APP_URL (http/https, success/cancel URLs)
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY when using --slug=
 *
 * Usage:
 *   node scripts/stripe-open-test-checkout.mjs --slug=your-league-slug --plan=pro
 *   node scripts/stripe-open-test-checkout.mjs --org=<uuid> --clerk-user=user_xxx --plan=enterprise
 *
 * Then:
 *   1. Open the printed URL in a browser (any window is fine — no Clerk cookie required).
 *   2. Pay with test card: 4242 4242 4242 4242, any future expiry, any CVC, any postal.
 *   3. For local dev webhooks: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *      and use the signing secret as STRIPE_WEBHOOK_SECRET in .env.local
 *   Or use a Dashboard webhook URL that hits your deployed /api/webhooks/stripe.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
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

loadDotEnvFile('.env.local')
loadDotEnvFile('.env')

function arg(name) {
  const pre = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(pre))
  return hit ? hit.slice(pre.length) : null
}

const slug = arg('slug')
const orgIdArg = arg('org')
const clerkUserArg = arg('clerk-user')
const plan = (arg('plan') || 'pro').toLowerCase()

const PLANS = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
}

const sk = process.env.STRIPE_SECRET_KEY?.trim()
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

if (!sk || !sk.startsWith('sk_test_')) {
  console.error('This script only runs with Stripe TEST secret keys (sk_test_...).')
  console.error('Set STRIPE_SECRET_KEY in .env.local to your test key from Dashboard → Developers → API keys.')
  process.exit(1)
}

if (!appUrl || !/^https?:\/\//i.test(appUrl)) {
  console.error('Set NEXT_PUBLIC_APP_URL in .env.local to your app base URL (e.g. http://localhost:3000).')
  process.exit(1)
}

const priceId = PLANS[plan]
if (!priceId || (plan !== 'pro' && plan !== 'enterprise')) {
  console.error('Use --plan=pro or --plan=enterprise and set STRIPE_PRO_PRICE_ID / STRIPE_ENTERPRISE_PRICE_ID.')
  process.exit(1)
}

async function resolveOrg() {
  if (slug) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('With --slug=, set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
      process.exit(1)
    }
    const supabase = createClient(url, key)
    const { data, error } = await supabase
      .from('organizations')
      .select('id, clerk_user_id, stripe_customer_id')
      .eq('slug', slug.trim())
      .maybeSingle()
    if (error) {
      console.error('Supabase:', error.message)
      process.exit(1)
    }
    if (!data?.id || !data?.clerk_user_id) {
      console.error(`No organization found for slug "${slug}" (need id + clerk_user_id).`)
      process.exit(1)
    }
    return { id: data.id, clerk_user_id: data.clerk_user_id, stripe_customer_id: data.stripe_customer_id }
  }
  if (!orgIdArg || !clerkUserArg) {
    console.error('Either pass --slug=your-league-slug or both --org=<organization uuid> and --clerk-user=user_xxx')
    process.exit(1)
  }
  return { id: orgIdArg.trim(), clerk_user_id: clerkUserArg.trim(), stripe_customer_id: null }
}

const org = await resolveOrg()

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })

let customerId = org.stripe_customer_id
if (!customerId) {
  const customer = await stripe.customers.create({
    metadata: {
      clerk_user_id: org.clerk_user_id,
      organization_id: org.id,
    },
  })
  customerId = customer.id
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey)
    await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id)
    console.log('Created Stripe customer and saved stripe_customer_id on the organization row.')
  } else {
    console.log('Created Stripe customer', customerId, '(set Supabase env vars to persist stripe_customer_id on the org).')
  }
}

const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  success_url: `${appUrl}/dashboard/settings?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/dashboard/settings?cancelled=true`,
  metadata: {
    clerk_user_id: org.clerk_user_id,
    organization_id: org.id,
    plan,
  },
  subscription_data: {
    metadata: {
      clerk_user_id: org.clerk_user_id,
      organization_id: org.id,
      plan,
    },
  },
})

console.log('')
console.log('--- Stripe test Checkout ready ---')
console.log('Organization:', org.id)
console.log('Plan:', plan)
console.log('')
console.log('Open this URL and complete payment with TEST card 4242 4242 4242 4242:')
console.log(session.url)
console.log('')
console.log('After paying, your app should update the org plan via:')
console.log('  - Webhook POST /api/webhooks/stripe (checkout.session.completed), or')
console.log('  - Loading Settings with ?upgraded=true&session_id=... (sync-checkout).')
console.log('')
console.log('Local webhook: stripe listen --forward-to localhost:3000/api/webhooks/stripe')
console.log('Then put the printed webhook signing secret in STRIPE_WEBHOOK_SECRET.')
console.log('')
