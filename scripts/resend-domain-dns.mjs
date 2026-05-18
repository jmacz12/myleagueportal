/**
 * Print DNS records Resend wants for domain verification (from Resend API).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (!m) continue
  let v = m[2]
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[m[1]] === undefined) process.env[m[1]] = v
}

const apiKey = process.env.RESEND_API_KEY?.trim()
const wantDomain = process.argv.find((a) => a.startsWith('--domain='))?.slice(9) || 'myleagueportal.com'

if (!apiKey) {
  console.error('RESEND_API_KEY missing in .env.local')
  process.exit(1)
}

const listRes = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${apiKey}` },
})
const listJson = await listRes.json()
if (!listRes.ok) {
  console.error('List domains failed:', listRes.status, JSON.stringify(listJson))
  process.exit(1)
}

const domains = listJson.data || []
const domain = domains.find((d) => d.name === wantDomain) || domains[0]
if (!domain?.id) {
  console.log('No domains found. Add', wantDomain, 'in Resend dashboard first.')
  process.exit(1)
}

const getRes = await fetch(`https://api.resend.com/domains/${domain.id}`, {
  headers: { Authorization: `Bearer ${apiKey}` },
})
const detail = await getRes.json()
if (!getRes.ok) {
  console.error('Get domain failed:', getRes.status, JSON.stringify(detail))
  process.exit(1)
}

console.log('Domain:', detail.name || domain.name)
console.log('Status:', detail.status)
console.log('Region:', detail.region || '(default)')
console.log('')

const records = detail.records || []
if (!records.length) {
  console.log('No records array in API response. Open Resend → Domains →', wantDomain, 'for DNS table.')
  console.log(JSON.stringify(detail, null, 2))
  process.exit(0)
}

console.log('Add these in Namecheap (Advanced DNS) for', wantDomain, ':\n')
console.log('| Type | Host | Value | Priority | Status |')
console.log('|------|------|-------|----------|--------|')
for (const r of records) {
  const host = r.name || r.record || '—'
  const type = r.type || '—'
  const value = (r.value || '—').replace(/\|/g, '\\|')
  const pri = r.priority ?? '—'
  const st = r.status || '—'
  console.log(`| ${type} | ${host} | ${value.slice(0, 60)}${value.length > 60 ? '…' : ''} | ${pri} | ${st} |`)
}

console.log('\nNamecheap tips:')
console.log('- Host = subdomain only (e.g. "send" not "send.myleagueportal.com")')
console.log('- Use "Automatic" TTL')
console.log('- No Cloudflare-style proxy on email DNS')
console.log('- After saving, wait 15–60 min, then Verify in Resend')
