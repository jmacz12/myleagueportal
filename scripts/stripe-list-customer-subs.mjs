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

const slug = process.argv.find((a) => a.startsWith('--slug='))?.slice(7) || 'vancouvarites'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: org } = await sb
  .from('organizations')
  .select('plan,stripe_customer_id,stripe_subscription_id')
  .eq('slug', slug)
  .single()

console.log('DB:', org)
if (!org?.stripe_customer_id) process.exit(0)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
const subs = await stripe.subscriptions.list({ customer: org.stripe_customer_id, status: 'all', limit: 20 })
console.log('\nStripe subscriptions for this customer:')
for (const s of subs.data) {
  const price = s.items.data[0]?.price
  console.log(`  ${s.id}  status=${s.status}  cancel_at_period_end=${s.cancel_at_period_end}  price=${price?.id} (${(price?.unit_amount || 0) / 100} ${price?.currency})`)
}
