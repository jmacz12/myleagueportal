/**
 * Cancel the extra Pro subscription (keep organizations.stripe_subscription_id).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (!m) continue
  let v = m[2]
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[m[1]] === undefined) process.env[m[1]] = v
}

const sk = process.env.STRIPE_SECRET_KEY?.trim()
if (!sk?.startsWith('sk_test_')) {
  console.error('Refusing: only runs with sk_test_ (test cleanup).')
  process.exit(1)
}

const slug = 'vancouvarites'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: org } = await sb
  .from('organizations')
  .select('stripe_customer_id,stripe_subscription_id')
  .eq('slug', slug)
  .single()

if (!org?.stripe_customer_id) {
  console.error('No customer')
  process.exit(1)
}

const stripe = new Stripe(sk, { apiVersion: '2026-04-22.dahlia' })
const subs = await stripe.subscriptions.list({ customer: org.stripe_customer_id, status: 'all', limit: 20 })
const keep = org.stripe_subscription_id
const extras = subs.data.filter((s) => s.id !== keep && (s.status === 'active' || s.status === 'trialing'))

for (const s of extras) {
  const cancelled = await stripe.subscriptions.cancel(s.id)
  console.log('Cancelled duplicate:', cancelled.id, 'status=', cancelled.status)
}

if (!extras.length) console.log('No duplicate active subscriptions to cancel.')
else console.log('Kept:', keep)
