/**
 * End-to-end smoke: create a disposable Clerk user + organizations row, run the same
 * teardown as POST /api/settings/delete-league-account (minus cookie auth), verify
 * org + user are gone. Requires .env.local: CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY (optional if org has no Stripe ids).
 *
 * Usage: npm run smoke:delete-account
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvLocal(): Record<string, string> {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return {}
  const raw = fs.readFileSync(p, 'utf8')
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

async function clerkApi(secret: string, method: string, pathname: string, body?: unknown) {
  const res = await fetch(`https://api.clerk.com/v1${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { res, json }
}

async function main() {
  const envLocal = loadEnvLocal()
  for (const [k, v] of Object.entries(envLocal)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  const { deleteOrganizationDatabaseRows, removeLeagueSiteFilesForOrg } = await import(
    '../lib/delete-organization-data.js'
  )
  const { stripe } = await import('../lib/stripe.js')

  const clerkSecret = process.env.CLERK_SECRET_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!clerkSecret || !url || !serviceKey) {
    console.error('Missing CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const stamp = `${Date.now()}`
  const email = `smoke-delete+${stamp}@example.com`
  const password = `SmokeDel${stamp.slice(-6)}!a1`

  console.log('1) Creating Clerk user', email)
  const create = await clerkApi(clerkSecret, 'POST', '/users', {
    first_name: 'Smoke',
    last_name: 'Delete',
    email_address: [email],
    password,
    skip_password_checks: true,
    skip_password_requirement: false,
  })

  if (!create.res.ok) {
    console.error('Clerk create failed', create.res.status, create.json)
    process.exit(1)
  }

  const created = create.json as { id?: string }
  const userId = created?.id
  if (!userId) {
    console.error('Clerk create: no user id', create.json)
    process.exit(1)
  }
  console.log('   userId=', userId)

  const supabase: SupabaseClient = createClient(url, serviceKey)
  const slug = `smoke-del-${stamp}`

  console.log('2) Inserting organization', slug)
  let ins = await supabase
    .from('organizations')
    .insert({
      name: 'Smoke Delete League',
      slug,
      clerk_user_id: userId,
      plan: 'basic',
      sport_template_id: 'basketball',
    })
    .select('id')
    .single()

  if (ins.error) {
    const msg = String(ins.error.message || '')
    if (msg.includes('sport_template_id') || msg.includes('schema cache')) {
      ins = await supabase
        .from('organizations')
        .insert({
          name: 'Smoke Delete League',
          slug,
          clerk_user_id: userId,
          plan: 'basic',
        })
        .select('id')
        .single()
    }
  }

  if (ins.error || !ins.data?.id) {
    console.error('Org insert failed', ins.error)
    await clerkApi(clerkSecret, 'DELETE', `/users/${userId}`)
    process.exit(1)
  }

  const orgId = ins.data.id as string
  console.log('   orgId=', orgId)

  const orgRow = await supabase
    .from('organizations')
    .select('id, stripe_customer_id, stripe_subscription_id')
    .eq('id', orgId)
    .single()

  const row = orgRow.data as {
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
  } | null

  console.log('3) Teardown (Stripe → storage → Postgres → Clerk)')
  const subId = row?.stripe_subscription_id
  const custId = row?.stripe_customer_id
  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      if (!/no such subscription|already been canceled|resource_missing/i.test(m)) console.warn('stripe cancel', m)
    }
  }
  if (custId) {
    try {
      await stripe.customers.del(custId)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      if (!/no such customer|resource_missing/i.test(m)) console.warn('stripe customer del', m)
    }
  }

  try {
    await removeLeagueSiteFilesForOrg(supabase, orgId)
  } catch (e) {
    console.warn('storage cleanup', e)
  }

  const dbResult = await deleteOrganizationDatabaseRows(supabase, orgId)
  if (!dbResult.ok) {
    console.error('DB delete failed', dbResult.message)
    await clerkApi(clerkSecret, 'DELETE', `/users/${userId}`)
    process.exit(1)
  }

  const delUser = await clerkApi(clerkSecret, 'DELETE', `/users/${userId}`)
  if (!delUser.res.ok && delUser.res.status !== 404) {
    console.error('Clerk delete user failed', delUser.res.status, delUser.json)
    process.exit(1)
  }

  console.log('4) Verifying')
  const { data: orgCheck } = await supabase.from('organizations').select('id').eq('id', orgId).maybeSingle()
  if (orgCheck) {
    console.error('Organization still exists after delete')
    process.exit(1)
  }

  const getUser = await clerkApi(clerkSecret, 'GET', `/users/${userId}`)
  if (getUser.res.status !== 404) {
    console.error('Clerk user still exists', getUser.res.status, getUser.json)
    process.exit(1)
  }

  console.log('OK — smoke delete league & account passed (Clerk user + org removed).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
