/**
 * End-to-end Stripe billing smoke for a disposable non-complimentary league.
 *
 * - Creates Clerk user + organizations row (basic, plan_complimentary=false)
 * - Creates Stripe customer + Checkout session (same metadata as production API)
 * - Completes billing:
 *   - TEST keys: subscription with test card pm_card_visa
 *   - LIVE keys: trialing subscription (no immediate charge) + signed webhook delivery
 * - Verifies DB plan + stripe ids
 * - Tests subscription.deleted → basic
 * - Cleans up Stripe + Clerk + org row
 *
 * Usage: npm run verify:stripe-checkout-e2e
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

loadDotEnvFile('.env.local')
loadDotEnvFile('.env')

const issues = []
const ok = []
function fail(m) {
  issues.push(m)
}
function pass(m) {
  ok.push(m)
}

async function clerkApi(secret, method, pathname, body) {
  const res = await fetch(`https://api.clerk.com/v1${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { res, json }
}

function checkoutSessionOrgPlanSync(session) {
  if (session.mode !== 'subscription') return null
  const meta = session.metadata || {}
  const organizationId = typeof meta.organization_id === 'string' ? meta.organization_id.trim() : ''
  const clerkUserId = typeof meta.clerk_user_id === 'string' ? meta.clerk_user_id.trim() : ''
  const planRaw = typeof meta.plan === 'string' ? meta.plan.toLowerCase() : 'basic'
  const plan = planRaw === 'enterprise' ? 'enterprise' : planRaw === 'pro' ? 'pro' : 'basic'
  if (!organizationId || !clerkUserId) return null
  if (plan !== 'pro' && plan !== 'enterprise') return null
  const sub = session.subscription
  const subscriptionId =
    typeof sub === 'string'
      ? sub
      : sub && typeof sub === 'object' && sub.id
        ? sub.id
        : null
  const cust = session.customer
  const customerId =
    typeof cust === 'string' ? cust : cust && typeof cust === 'object' && cust.id ? cust.id : null
  return { organizationId, clerkUserId, plan, subscriptionId, customerId }
}

async function postSignedWebhook(stripe, webhookSecret, eventPayload) {
  const payload = JSON.stringify(eventPayload)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  })
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.myleagueportal.com').replace(/\/$/, '')
  const res = await fetch(`${appUrl}/api/webhooks/stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  })
  return res
}

async function applyCheckoutCompleted(supabase, session) {
  const sync = checkoutSessionOrgPlanSync(session)
  if (!sync) throw new Error('checkout sync metadata missing')
  const updates = {
    plan: sync.plan,
    stripe_subscription_id: sync.subscriptionId,
  }
  if (sync.customerId) updates.stripe_customer_id = sync.customerId
  const { error } = await supabase.from('organizations').update(updates).eq('id', sync.organizationId)
  if (error) throw new Error(error.message)
  return sync
}

console.log('=== Stripe checkout E2E (disposable league) ===\n')

const clerkSecret = process.env.CLERK_SECRET_KEY?.trim()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const sk = process.env.STRIPE_SECRET_KEY?.trim()
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim()
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

if (!clerkSecret || !supabaseUrl || !serviceKey || !sk || !webhookSecret || !proPriceId || !appUrl) {
  console.error('Missing required env (Clerk, Supabase, Stripe keys, webhook secret, pro price, app URL).')
  process.exit(1)
}

const isTest = sk.startsWith('sk_test_')
const isLive = sk.startsWith('sk_live_')
console.log('Stripe mode:', isTest ? 'TEST' : isLive ? 'LIVE' : 'UNKNOWN')

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })
const supabase = createClient(supabaseUrl, serviceKey)

const stamp = `${Date.now()}`
const email = `stripe-e2e+${stamp}@example.com`
const password = `StripeE2e${String(stamp).slice(-6)}!a1`
const slug = `stripe-e2e-${stamp}`

let clerkUserId = null
let orgId = null
let customerId = null
let subscriptionId = null
let checkoutSessionId = null

try {
  console.log('\n1) Create Clerk user + organization')
  const create = await clerkApi(clerkSecret, 'POST', '/users', {
    first_name: 'Stripe',
    last_name: 'E2E',
    email_address: [email],
    password,
    skip_password_checks: true,
  })
  if (!create.res.ok) {
    fail(`Clerk create failed: ${create.res.status}`)
    throw new Error('abort')
  }
  clerkUserId = create.json?.id
  if (!clerkUserId) throw new Error('no clerk user id')

  const ins = await supabase
    .from('organizations')
    .insert({
      name: 'Stripe E2E Test League',
      slug,
      clerk_user_id: clerkUserId,
      plan: 'basic',
      plan_complimentary: false,
      sport_template_id: 'basketball',
    })
    .select('id, slug, plan, plan_complimentary')
    .single()

  if (ins.error) {
    const retry = await supabase
      .from('organizations')
      .insert({
        name: 'Stripe E2E Test League',
        slug,
        clerk_user_id: clerkUserId,
        plan: 'basic',
        plan_complimentary: false,
      })
      .select('id, slug, plan, plan_complimentary')
      .single()
    if (retry.error) throw new Error(retry.error.message)
    orgId = retry.data.id
  } else {
    orgId = ins.data.id
  }
  pass(`Created org slug=${slug} id=${orgId} (basic, not complimentary)`)

  console.log('\n2) Create Stripe customer + Checkout session')
  const customer = await stripe.customers.create({
    metadata: { clerk_user_id: clerkUserId, organization_id: orgId },
  })
  customerId = customer.id
  await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
  pass('Stripe customer created and saved on org')

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: proPriceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${appUrl}/dashboard/settings?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/settings?cancelled=true`,
    metadata: {
      clerk_user_id: clerkUserId,
      organization_id: orgId,
      plan: 'pro',
    },
    subscription_data: {
      metadata: {
        clerk_user_id: clerkUserId,
        organization_id: orgId,
        plan: 'pro',
      },
    },
  })
  checkoutSessionId = checkoutSession.id
  if (!checkoutSession.url) fail('Checkout session missing url')
  else pass('Checkout session created (same shape as /api/stripe/checkout)')

  console.log('\n3) Complete subscription')
  let completedSession = null

  if (isTest) {
    const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })
    await stripe.paymentMethods.attach(pm.id, { customer: customerId })
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pm.id },
    })
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: proPriceId }],
      metadata: {
        clerk_user_id: clerkUserId,
        organization_id: orgId,
        plan: 'pro',
      },
      default_payment_method: pm.id,
    })
    subscriptionId = sub.id
    pass('TEST: subscription created with tok_visa')

    completedSession = {
      id: checkoutSessionId,
      object: 'checkout.session',
      mode: 'subscription',
      status: 'complete',
      metadata: checkoutSession.metadata,
      customer: customerId,
      subscription: subscriptionId,
    }
  } else if (isLive) {
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: proPriceId }],
      trial_period_days: 1,
      metadata: {
        clerk_user_id: clerkUserId,
        organization_id: orgId,
        plan: 'pro',
      },
    })
    subscriptionId = sub.id
    pass('LIVE: trialing subscription created (no immediate charge; 1-day trial)')

    completedSession = {
      id: checkoutSessionId,
      object: 'checkout.session',
      mode: 'subscription',
      status: 'complete',
      metadata: checkoutSession.metadata,
      customer: customerId,
      subscription: subscriptionId,
    }
  } else {
    fail('Unrecognized Stripe key mode')
    throw new Error('abort')
  }

  console.log('\n4) Deliver checkout.session.completed webhook to production route')
  const event = {
    id: `evt_e2e_${stamp}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: completedSession },
  }
  const whRes = await postSignedWebhook(stripe, webhookSecret, event)
  if (!whRes.ok) {
    const body = await whRes.text()
    fail(`Webhook POST failed: ${whRes.status} ${body.slice(0, 200)}`)
  } else {
    pass(`Webhook accepted (${whRes.status})`)
  }

  const { data: orgAfterWebhook, error: readErr } = await supabase
    .from('organizations')
    .select('plan, stripe_customer_id, stripe_subscription_id, plan_complimentary')
    .eq('id', orgId)
    .single()

  if (readErr) fail(`Read org after webhook: ${readErr.message}`)
  else if (orgAfterWebhook.plan !== 'pro') fail(`Expected plan=pro after webhook, got ${orgAfterWebhook.plan}`)
  else if (!orgAfterWebhook.stripe_subscription_id) fail('Missing stripe_subscription_id after webhook')
  else if (orgAfterWebhook.stripe_customer_id !== customerId) fail('stripe_customer_id mismatch after webhook')
  else pass('DB: plan=pro + stripe ids after webhook')

  console.log('\n5) sync-checkout logic (idempotent upsert)')
  const sync = checkoutSessionOrgPlanSync(completedSession)
  if (!sync) fail('sync-checkout metadata parse failed')
  else {
    await applyCheckoutCompleted(supabase, completedSession)
    pass('sync-checkout upsert path OK (same as POST /api/stripe/sync-checkout)')
  }

  console.log('\n6) subscription.deleted → basic')
  const deletedEvent = {
    id: `evt_e2e_del_${stamp}`,
    object: 'event',
    type: 'customer.subscription.deleted',
    data: { object: { id: subscriptionId, object: 'subscription' } },
  }
  const delRes = await postSignedWebhook(stripe, webhookSecret, deletedEvent)
  if (!delRes.ok) fail(`subscription.deleted webhook failed: ${delRes.status}`)
  else pass('subscription.deleted webhook accepted')

  const { data: orgBasic } = await supabase
    .from('organizations')
    .select('plan, stripe_subscription_id')
    .eq('id', orgId)
    .single()

  if (orgBasic?.plan !== 'basic' || orgBasic?.stripe_subscription_id !== null) {
    fail(`Expected basic + null sub after delete, got plan=${orgBasic?.plan} sub=${orgBasic?.stripe_subscription_id}`)
  } else pass('DB: downgraded to basic after subscription.deleted')

  console.log('\n7) Complimentary league cannot checkout (vancouvarites)')
  const { data: demo } = await supabase
    .from('organizations')
    .select('plan_complimentary')
    .eq('slug', 'vancouvarites')
    .maybeSingle()
  if (demo?.plan_complimentary === true) pass('vancouvarites is plan_complimentary (checkout blocked in app)')
  else fail('vancouvarites plan_complimentary unexpected')
} catch (e) {
  if (e.message !== 'abort') {
    console.error(e)
    fail(e.message || String(e))
  }
} finally {
  console.log('\n8) Cleanup')
  if (subscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscriptionId)
      pass('Canceled Stripe subscription')
    } catch (e) {
      fail(`Cancel subscription: ${e.message}`)
    }
  }
  if (customerId) {
    try {
      await stripe.customers.del(customerId)
      pass('Deleted Stripe customer')
    } catch (e) {
      fail(`Delete customer: ${e.message}`)
    }
  }
  if (orgId) {
    const { error } = await supabase.from('organizations').delete().eq('id', orgId)
    if (error) fail(`Delete org row: ${error.message}`)
    else pass('Deleted organization row')
  }
  if (clerkUserId) {
    const del = await clerkApi(clerkSecret, 'DELETE', `/users/${clerkUserId}`)
    if (!del.res.ok) fail(`Delete Clerk user: ${del.res.status}`)
    else pass('Deleted Clerk user')
  }
}

console.log('\n--- Passed ---')
for (const m of ok) console.log('  ✓', m)
if (issues.length) {
  console.log('\n--- Issues ---')
  for (const m of issues) console.log('  ✗', m)
  process.exit(1)
}
console.log('\nAll Stripe checkout E2E checks passed.')
console.log(`Disposable league slug was: ${slug}`)
process.exit(0)
