import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { isProOrEnterprise } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AUTO_TEAM_COLORS = [
  '#5a7a2a',
  '#1d4ed8',
  '#b45309',
  '#7c3aed',
  '#be185d',
  '#0f766e',
  '#c2410c',
  '#4338ca',
]

/**
 * Pro / Enterprise: create `Team 1…N` for a **season that has no teams yet**,
 * then round-robin assign **unassigned** season players across them.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only the league owner can create teams.' }, { status: 403 })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (!isProOrEnterprise(org.plan)) {
    return NextResponse.json(
      { error: 'Auto-create teams is available on Pro and Enterprise.' },
      { status: 403 }
    )
  }

  let body: { season_id?: unknown; team_count?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const seasonId = typeof body.season_id === 'string' ? body.season_id.trim() : ''
  if (!seasonId) {
    return NextResponse.json({ error: 'season_id is required.' }, { status: 400 })
  }

  let teamCount = Number(body.team_count)
  if (!Number.isFinite(teamCount) || teamCount < 2) teamCount = 2
  if (teamCount > 12) teamCount = 12

  const { data: season, error: seasonErr } = await supabaseAdmin
    .from('seasons')
    .select('id, organization_id, type')
    .eq('id', seasonId)
    .eq('organization_id', org.id)
    .eq('type', 'season')
    .maybeSingle()

  if (seasonErr || !season) {
    return NextResponse.json({ error: 'Season not found.' }, { status: 404 })
  }

  const { count: existingTeamCount, error: countErr } = await supabaseAdmin
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('organization_id', org.id)

  if (countErr) {
    return NextResponse.json({ error: 'Could not check existing teams.' }, { status: 500 })
  }
  if ((existingTeamCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This season already has teams. Remove them first, or add and assign teams manually.',
      },
      { status: 400 }
    )
  }

  const rows = Array.from({ length: teamCount }, (_, i) => ({
    name: `Team ${i + 1}`,
    color: AUTO_TEAM_COLORS[i % AUTO_TEAM_COLORS.length],
    season_id: seasonId,
    organization_id: org.id,
  }))

  const { data: created, error: insertErr } = await supabaseAdmin.from('teams').insert(rows).select('id')

  if (insertErr || !created?.length) {
    console.error('auto-create teams insert', insertErr)
    return NextResponse.json({ error: 'Failed to create teams.' }, { status: 500 })
  }

  const teamIds = created.map((t) => String((t as { id: string }).id))

  const { data: unassigned } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('organization_id', org.id)
    .eq('season_id', seasonId)
    .is('team_id', null)
    .order('registered_at', { ascending: true })

  const playerIds = (unassigned || []).map((p) => String((p as { id: string }).id))
  let playersAssigned = 0
  for (let i = 0; i < playerIds.length; i++) {
    const teamId = teamIds[i % teamIds.length]
    const { error: uerr } = await supabaseAdmin
      .from('players')
      .update({ team_id: teamId })
      .eq('id', playerIds[i])
      .eq('organization_id', org.id)
      .eq('season_id', seasonId)
    if (!uerr) playersAssigned++
  }

  return NextResponse.json({
    ok: true,
    teams_created: created.length,
    players_assigned: playersAssigned,
    team_ids: teamIds,
  })
}
