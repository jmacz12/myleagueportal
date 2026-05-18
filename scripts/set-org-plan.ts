/**
 * Set organization plan by slug (service role).
 * Usage: npx tsx scripts/set-org-plan.ts --slug=vancouvarites --plan=pro
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const slug = process.argv.find((a) => a.startsWith('--slug='))?.slice(7) || 'vancouvarites'
const plan = process.argv.find((a) => a.startsWith('--plan='))?.slice(7) || 'pro'

if (!['basic', 'pro', 'enterprise'].includes(plan)) {
  console.error('plan must be basic, pro, or enterprise')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const clearStripe = process.argv.includes('--clear-stripe')
  const complimentary = process.argv.includes('--complimentary')
  const patch: {
    plan: string
    stripe_customer_id?: null
    stripe_subscription_id?: null
    plan_complimentary?: boolean
  } = { plan }
  if (clearStripe) {
    patch.stripe_customer_id = null
    patch.stripe_subscription_id = null
  }
  if (complimentary) {
    patch.plan_complimentary = true
  }

  const { data, error } = await sb
    .from('organizations')
    .update(patch)
    .eq('slug', slug)
    .select('slug, name, plan, plan_complimentary, stripe_customer_id, stripe_subscription_id')
    .single()

  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log(
    `Updated "${data?.name}" (${data?.slug}) → plan: ${data?.plan}` +
      (data?.plan_complimentary ? ' (complimentary)' : '')
  )
}

main()
