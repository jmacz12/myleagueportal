import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sb
    .from('organizations')
    .select('slug, plan, stripe_customer_id, stripe_subscription_id')
    .order('created_at', { ascending: false })
    .limit(20)

  for (const o of data ?? []) {
    console.log(
      `${o.slug?.padEnd(24)} ${String(o.plan).padEnd(12)} customer=${o.stripe_customer_id ? 'yes' : 'no '} sub=${o.stripe_subscription_id ? 'yes' : 'no'}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
