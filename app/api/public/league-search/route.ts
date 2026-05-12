import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Strip characters that act as wildcards in SQL ILIKE for predictable public search. */
function sanitizeSearchTerm(raw: string): string {
  return raw.trim().slice(0, 64).replace(/%/g, '').replace(/_/g, '').replace(/\\/g, '')
}

export type PublicLeagueSearchLeague = { id: string; name: string; slug: string }
export type PublicLeagueSearchTeam = {
  id: string
  name: string
  leagueSlug: string
  leagueName: string
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const safe = sanitizeSearchTerm(searchParams.get('q') ?? '')
  if (safe.length < 2) {
    return NextResponse.json({ leagues: [] as PublicLeagueSearchLeague[], teams: [] as PublicLeagueSearchTeam[] })
  }

  const pattern = `%${safe}%`

  const [bySlug, byName] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, name, slug').ilike('slug', pattern).limit(10),
    supabaseAdmin.from('organizations').select('id, name, slug').ilike('name', pattern).limit(10),
  ])

  if (bySlug.error || byName.error) {
    return NextResponse.json({ error: 'Search unavailable' }, { status: 500 })
  }

  const leagueMap = new Map<string, PublicLeagueSearchLeague>()
  for (const row of [...(bySlug.data || []), ...(byName.data || [])]) {
    if (row?.id && row.slug) {
      leagueMap.set(row.id, { id: row.id, name: String(row.name || ''), slug: String(row.slug) })
    }
  }
  const leagues = [...leagueMap.values()].slice(0, 10)

  const { data: teamRows, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, name, organization_id')
    .ilike('name', pattern)
    .limit(24)

  if (teamErr) {
    return NextResponse.json({ error: 'Search unavailable' }, { status: 500 })
  }

  const orgIds = [...new Set((teamRows || []).map((t) => t.organization_id).filter(Boolean))] as string[]
  const orgsById = new Map<string, { slug: string; name: string }>()
  if (orgIds.length > 0) {
    const { data: orgRows, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name')
      .in('id', orgIds)

    if (orgErr) {
      return NextResponse.json({ error: 'Search unavailable' }, { status: 500 })
    }
    for (const o of orgRows || []) {
      if (o?.id && o.slug) {
        orgsById.set(o.id, { slug: String(o.slug), name: String(o.name || '') })
      }
    }
  }

  const teams: PublicLeagueSearchTeam[] = []
  for (const t of teamRows || []) {
    const org = orgsById.get(t.organization_id)
    if (!org?.slug) continue
    teams.push({
      id: t.id,
      name: String(t.name || ''),
      leagueSlug: org.slug,
      leagueName: org.name,
    })
    if (teams.length >= 15) break
  }

  return NextResponse.json({ leagues, teams })
}
