/**
 * Money-path audit: env, Stripe prices, webhooks, org billing row, subscription status.
 * Does not print secret values.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
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
if (envFileArg) {
  loadDotEnvFile(envFileArg)
} else {
  loadDotEnvFile('.env.local')
  loadDotEnvFile('.env')
}

const slug = process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length) || 'vancouvarites'
const sk = process.env.STRIPE_SECRET_KEY?.trim()
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

const issues = []
const ok = []

function fail(msg) {
  issues.push(msg)
}
function pass(msg) {
  ok.push(msg)
}

console.log('=== Money path audit ===\n')

if (!sk) {
  fail('STRIPE_SECRET_KEY missing')
} else {
  const mode = sk.startsWith('sk_test_') ? 'TEST' : sk.startsWith('sk_live_') ? 'LIVE' : 'UNKNOWN'
  console.log('Stripe key mode:', mode)
  if (mode === 'TEST') {
    pass('Using Stripe test keys (safe for script checks)')
  } else if (mode === 'LIVE') {
    pass('Using Stripe live keys')
  } else {
    fail('Stripe secret key format unrecognized')
  }
}

function modeLabel() {
  if (!sk) return '?'
  return sk.startsWith('sk_test_') ? 'TEST' : sk.startsWith('sk_live_') ? 'LIVE' : '?'
}

if (!appUrl || !/^https?:\/\//i.test(appUrl)) {
  fail('NEXT_PUBLIC_APP_URL missing or invalid')
} else {
  pass(`NEXT_PUBLIC_APP_URL set (${appUrl})`)
  if (appUrl.includes('localhost') && modeLabel() === 'LIVE') {
    fail('LIVE Stripe keys with localhost app URL — Checkout success URLs may be wrong in production')
  }
}

const proId = process.env.STRIPE_PRO_PRICE_ID?.trim()
const entId = process.env.STRIPE_ENTERPRISE_PRICE_ID?.trim()
if (!proId || !entId) fail('Pro or Enterprise price id missing')
else pass('Pro + Enterprise price ids set')

if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
  fail('STRIPE_WEBHOOK_SECRET missing — webhooks cannot verify')
} else {
  pass('STRIPE_WEBHOOK_SECRET set')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  fail('Supabase URL or service role key missing')
} else {
  pass('Supabase admin credentials set')
}

let stripe = null
if (sk) {
  stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })
  for (const [label, id] of [
    ['Pro', proId],
    ['Enterprise', entId],
  ]) {
    if (!id) continue
    try {
      const p = await stripe.prices.retrieve(id)
      if (!p.active) fail(`${label} price inactive in Stripe`)
      else if (p.type !== 'recurring') fail(`${label} price is not recurring`)
      else pass(`${label} price active (${p.unit_amount / 100} ${String(p.currency).toUpperCase()}/mo)`)
    } catch (e) {
      fail(`${label} price lookup failed: ${e.message}`)
    }
  }

  try {
    const hooks = await stripe.webhookEndpoints.list({ limit: 20 })
    const ours = hooks.data.filter((h) => (h.url || '').includes('/api/webhooks/stripe'))
    if (!ours.length) {
      fail('No Stripe webhook endpoint for /api/webhooks/stripe in this Stripe account')
    } else {
      for (const h of ours) {
        const enabled = h.status === 'enabled'
        const events = (h.enabled_events || []).join(', ')
        pass(`Webhook: ${h.url} (${h.status}; events: ${events || 'default'})`)
        if (!enabled) fail(`Webhook disabled: ${h.url}`)
        const need = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted']
        const missing = need.filter((ev) => !h.enabled_events?.includes(ev) && h.enabled_events?.[0] !== '*')
        if (missing.length && h.enabled_events?.[0] !== '*') {
          fail(`Webhook may be missing events: ${missing.join(', ')}`)
        }
      }
    }
  } catch (e) {
    fail(`Could not list webhooks: ${e.message}`)
  }
}

if (supabaseUrl && serviceKey) {
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, slug, plan, stripe_customer_id, stripe_subscription_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) fail(`Org query failed: ${error.message}`)
  else if (!org) fail(`No org for slug "${slug}"`)
  else {
    pass(`Org "${slug}" plan in DB: ${org.plan}`)
    if (org.plan === 'basic') {
      fail('Demo org is still Basic — paid features may be gated')
    }
    if (org.plan === 'pro' || org.plan === 'enterprise') {
      if (!org.stripe_subscription_id) {
        fail('Paid plan in DB but no stripe_subscription_id (upgrade may be manual or sync-only)')
      } else {
        pass(`stripe_subscription_id present (${org.stripe_subscription_id.slice(0, 12)}…)`)
      }
      if (!org.stripe_customer_id) {
        fail('Paid plan but no stripe_customer_id')
      } else {
        pass('stripe_customer_id present')
      }
    }

    if (stripe && org.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id)
        const status = sub.status
        if (status === 'active' || status === 'trialing') {
          pass(`Stripe subscription status: ${status}`)
        } else {
          fail(`Stripe subscription status: ${status} (billing may not renew correctly)`)
        }
        const priceId = sub.items?.data?.[0]?.price?.id
        const mapped =
          priceId === proId ? 'pro' : priceId === entId ? 'enterprise' : null
        if (mapped && mapped !== org.plan) {
          fail(`DB plan "${org.plan}" does not match Stripe price (${mapped})`)
        } else if (mapped) {
          pass(`Stripe price matches DB plan (${mapped})`)
        }
      } catch (e) {
        fail(`Could not retrieve subscription in this Stripe account: ${e.message}`)
        if (modeLabel() === 'TEST') {
          fail('If org was upgraded in LIVE mode, local TEST keys cannot see that subscription')
        }
      }
    }
  }
}

// Production webhook route reachability (unsigned POST should 400, not 404/500)
const prodBase = 'https://www.myleagueportal.com'
try {
  const res = await fetch(`${prodBase}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (res.status === 400) pass('Production /api/webhooks/stripe reachable (rejects bad signature as expected)')
  else if (res.status === 404) fail('Production webhook route returned 404')
  else fail(`Production webhook returned unexpected status ${res.status}`)
} catch (e) {
  fail(`Production webhook probe failed: ${e.message}`)
}

console.log('\n--- Passed ---')
for (const m of ok) console.log('  ✓', m)
if (issues.length) {
  console.log('\n--- Issues ---')
  for (const m of issues) console.log('  ✗', m)
  process.exit(1)
}
console.log('\nAll checks passed.')
process.exit(0)
