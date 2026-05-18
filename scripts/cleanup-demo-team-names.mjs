/**
 * Strip "[SEED] " from team names for a showcase league (default: vancouvarites).
 *
 * Usage:
 *   npm run cleanup:demo-team-names
 *   npm run cleanup:demo-team-names -- --slug=my-league
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const SEED_PREFIX = '[SEED]'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadDotEnvFile(name) {
  const p = path.join(root, name)
  if (!fs.existsSync(p)) return false
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val
  }
  return true
}

loadDotEnvFile('.env.local')
loadDotEnvFile('.env')

const slug =
  process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length)?.trim() ||
  process.env.SEED_LEAGUE_SLUG?.trim() ||
  'vancouvarites'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data: org, error: orgErr } = await supabase
  .from('organizations')
  .select('id, name, slug')
  .eq('slug', slug)
  .maybeSingle()

if (orgErr || !org) {
  console.error(orgErr?.message || `No organization with slug "${slug}"`)
  process.exit(1)
}

const { data: teams, error: teamsErr } = await supabase
  .from('teams')
  .select('id, name')
  .eq('organization_id', org.id)
  .like('name', `${SEED_PREFIX}%`)

if (teamsErr) {
  console.error(teamsErr.message)
  process.exit(1)
}

if (!teams?.length) {
  console.log(`No teams with "${SEED_PREFIX}" prefix on ${slug} — nothing to change.`)
  process.exit(0)
}

console.log(`Cleaning ${teams.length} team name(s) on ${org.name} (${slug})…\n`)

let renamed = 0
for (const row of teams) {
  const clean = String(row.name || '')
    .replace(SEED_PREFIX, '')
    .trim()
  if (!clean || clean === row.name) continue
  const { error } = await supabase.from('teams').update({ name: clean }).eq('id', row.id)
  if (error) {
    console.error(`  ✗ ${row.name} → ${clean}: ${error.message}`)
  } else {
    console.log(`  ✓ ${row.name} → ${clean}`)
    renamed++
  }
}

console.log(`\nDone. Renamed ${renamed} team(s).`)
process.exit(renamed === teams.length ? 0 : 1)
