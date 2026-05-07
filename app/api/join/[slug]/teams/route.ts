import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Public team directory for /join/[slug] — Basic tier (no stats, no contact info).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugRaw } = await params
  const slug = normalizeJoinSlugParam(slugRaw)
  if (!slug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const orgHub = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!orgHub?.id) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  const org = { id: orgHub.id }

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .select('id, name, color, season_id')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })

  if (teamsError) {
    return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 })
  }

  const list = teams || []
  if (list.length === 0) {
    return NextResponse.json({ teams: [] })
  }

  const seasonIds = [...new Set(list.map((t) => t.season_id).filter(Boolean))] as string[]

  let seasonName = new Map<string, string>()
  if (seasonIds.length > 0) {
    const { data: seasons } = await supabaseAdmin
      .from('seasons')
      .select('id, name')
      .in('id', seasonIds)
    seasonName = new Map((seasons || []).map((s) => [s.id, s.name]))
  }

  const teamIds = list.map((t) => t.id)
  const { data: rosterRows } = await supabaseAdmin
    .from('players')
    .select('team_id')
    .in('team_id', teamIds)

  const counts: Record<string, number> = {}
  for (const row of rosterRows || []) {
    if (row.team_id) counts[row.team_id] = (counts[row.team_id] || 0) + 1
  }

  const { data: openPolls } = await supabaseAdmin
    .from('jersey_polls')
    .select('id, team_id')
    .eq('status', 'open')
    .in('team_id', teamIds)

  const pollByTeam = new Map<string, string>()
  for (const p of openPolls || []) {
    pollByTeam.set(p.team_id, p.id)
  }

  return NextResponse.json({
    teams: list.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      season_id: t.season_id,
      season_name: (t.season_id && seasonName.get(t.season_id)) || 'Season',
      player_count: counts[t.id] || 0,
      open_jersey_poll_id: pollByTeam.get(t.id) ?? null,
    })),
  })
}
