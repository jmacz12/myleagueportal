import fs from 'node:fs'
const file = process.argv[2] || '.env.vercel.production'
if (!fs.existsSync(file)) {
  console.error('Missing', file)
  process.exit(1)
}
const t = fs.readFileSync(file, 'utf8')
for (const k of ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']) {
  const m = t.match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) {
    console.log(k, 'missing')
    continue
  }
  const v = m[1].replace(/^"|"$/g, '')
  let mode = 'unknown'
  if (v.startsWith('sk_live') || v.startsWith('pk_live')) mode = 'LIVE'
  else if (v.startsWith('sk_test') || v.startsWith('pk_test')) mode = 'TEST'
  console.log(k, mode)
}
