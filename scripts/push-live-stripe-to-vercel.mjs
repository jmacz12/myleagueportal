/**
 * Push live Stripe env vars from .env.local to Vercel Production, then redeploy.
 * Requires: vercel CLI logged in, project linked, live keys in .env.local
 *
 * Add to .env.local (from Stripe Dashboard, Live mode):
 *   STRIPE_LIVE_SECRET_KEY=sk_live_...
 *   STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_...
 *   STRIPE_LIVE_WEBHOOK_SECRET=whsec_...
 *   STRIPE_LIVE_PRO_PRICE_ID=price_...
 *   STRIPE_LIVE_ENTERPRISE_PRICE_ID=price_...
 *
 * Usage: node scripts/push-live-stripe-to-vercel.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env.local')

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local')
    process.exit(1)
  }
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

function keyMode(v) {
  if (!v) return 'missing'
  if (v.startsWith('sk_live') || v.startsWith('pk_live')) return 'live'
  if (v.startsWith('sk_test') || v.startsWith('pk_test')) return 'test'
  return 'other'
}

const env = loadEnv()

const sk =
  env.STRIPE_LIVE_SECRET_KEY?.trim() ||
  (keyMode(env.STRIPE_SECRET_KEY) === 'live' ? env.STRIPE_SECRET_KEY?.trim() : '')
const pk =
  env.STRIPE_LIVE_PUBLISHABLE_KEY?.trim() ||
  (keyMode(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) === 'live'
    ? env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
    : '')
const whsec = env.STRIPE_LIVE_WEBHOOK_SECRET?.trim() || env.STRIPE_WEBHOOK_SECRET?.trim()
const proPrice = env.STRIPE_LIVE_PRO_PRICE_ID?.trim() || env.STRIPE_PRO_PRICE_ID?.trim()
const entPrice = env.STRIPE_LIVE_ENTERPRISE_PRICE_ID?.trim() || env.STRIPE_ENTERPRISE_PRICE_ID?.trim()
const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || 'https://www.myleagueportal.com'

const missing = []
if (keyMode(sk) !== 'live') missing.push('sk_live secret (STRIPE_LIVE_SECRET_KEY)')
if (keyMode(pk) !== 'live') missing.push('pk_live publishable (STRIPE_LIVE_PUBLISHABLE_KEY)')
if (!whsec?.startsWith('whsec_')) missing.push('webhook secret (STRIPE_LIVE_WEBHOOK_SECRET)')
if (!proPrice?.startsWith('price_')) missing.push('STRIPE_LIVE_PRO_PRICE_ID')
if (!entPrice?.startsWith('price_')) missing.push('STRIPE_LIVE_ENTERPRISE_PRICE_ID')

if (missing.length) {
  console.error('Add these to .env.local (Live mode in Stripe Dashboard):\n')
  for (const m of missing) console.error('  -', m)
  process.exit(1)
}

const pairs = [
  ['STRIPE_SECRET_KEY', sk],
  ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', pk],
  ['STRIPE_WEBHOOK_SECRET', whsec],
  ['STRIPE_PRO_PRICE_ID', proPrice],
  ['STRIPE_ENTERPRISE_PRICE_ID', entPrice],
  ['NEXT_PUBLIC_APP_URL', appUrl],
]

function vercel(args, stdin) {
  const r = spawnSync('npx', ['vercel', ...args], {
    cwd: root,
    input: stdin,
    encoding: 'utf8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  return r
}

console.log('Pushing live Stripe vars to Vercel Production…\n')

for (const [name, value] of pairs) {
  console.log(`  ${name}…`)
  vercel(['env', 'rm', name, 'production', '--yes'], '')
  const add = vercel(['env', 'add', name, 'production'], value)
  if (add.status !== 0) {
    console.error(add.stderr || add.stdout)
    process.exit(1)
  }
}

console.log('\nRedeploying production…')
const deploy = vercel(['deploy', '--prod', '--yes'], '')
if (deploy.status !== 0) {
  console.error(deploy.stderr || deploy.stdout)
  process.exit(1)
}
console.log('\nDone. Run: npm run verify:stripe-money-path (with live keys in .env.local)')
