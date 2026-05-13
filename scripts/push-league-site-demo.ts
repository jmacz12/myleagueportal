/**
 * Push everyday demo league site JSON to Supabase (draft + published) for a league slug.
 * Updates the **live** public league page at `/league/[slug]` — no team wipe.
 *
 *   npx tsx scripts/push-league-site-demo.ts --slug=vancouvarites
 *   SEED_LEAGUE_SLUG=vancouvarites npx tsx scripts/push-league-site-demo.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { everydayLeagueSiteDemoPayload } from '../lib/everyday-league-site-demo'

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

function parseSlug(argv: string[]): string | undefined {
  for (const a of argv) {
    if (a.startsWith('--slug=')) return a.slice('--slug='.length).trim() || undefined
  }
  return undefined
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).')
    process.exit(1)
  }

  const slug = parseSlug(process.argv.slice(2)) || env.SEED_LEAGUE_SLUG?.trim()
  if (!slug) {
    console.error('Usage: npx tsx scripts/push-league-site-demo.ts --slug=your-league-slug')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const { data: org, error: orgErr } = await supabase.from('organizations').select('id').eq('slug', slug).single()

  if (orgErr || !org?.id) {
    console.error(`No organization with slug "${slug}":`, orgErr?.message || 'not found')
    process.exit(1)
  }

  const payload = everydayLeagueSiteDemoPayload()
  const row = {
    organization_id: org.id,
    draft: payload,
    published: payload,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('league_site_content').upsert(row, { onConflict: 'organization_id' })
  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, slug, organization_id: org.id, sections: payload.sections?.length ?? 0 }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
