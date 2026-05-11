/**
 * Seed recurring Monday/Wednesday drop-ins + demo registrations (uses service role).
 *
 *   npx tsx scripts/seed-dropin-cli.ts --slug=my-league
 *   SEED_LEAGUE_SLUG=my-league npx tsx scripts/seed-dropin-cli.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { seedDropinDemo } from '../lib/seed-dropin-demo'

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

function parseArgs(argv: string[]): { slug?: string; months?: number } {
  let slug: string | undefined
  let months: number | undefined
  for (const a of argv) {
    if (a.startsWith('--slug=')) slug = a.slice('--slug='.length).trim()
    else if (a.startsWith('--months=')) months = parseInt(a.slice('--months='.length), 10)
  }
  return { slug, months }
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).')
    process.exit(1)
  }

  const { slug: argSlug, months } = parseArgs(process.argv.slice(2))
  const slug = argSlug || env.SEED_LEAGUE_SLUG?.trim()

  if (!slug) {
    const supabase = createClient(url, key)
    const { data: orgs } = await supabase.from('organizations').select('slug').order('slug').limit(10)
    console.error('Usage: npx tsx scripts/seed-dropin-cli.ts --slug=your-league-slug')
    console.error('Optional: --months=4 (3–5) for recurring horizon.')
    if (orgs?.length) {
      console.error('Example slugs in this database:', orgs.map((o) => o.slug).join(', '))
    }
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const result = await seedDropinDemo(supabase, slug, {
    recurringMonths: Number.isFinite(months as number) ? months : undefined,
  })

  if (!result.ok) {
    console.error(result.error)
    if (result.hint) console.error(result.hint)
    process.exit(1)
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
