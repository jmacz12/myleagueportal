import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { normalizeOrgPlan } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, plan')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const list = teams || []
  const teamIds = list.map((t) => t.id)
  const counts: Record<string, number> = {}
  if (teamIds.length > 0) {
    const { data: rosterRows } = await supabaseAdmin
      .from('players')
      .select('team_id')
      .in('team_id', teamIds)
    for (const row of rosterRows || []) {
      if (row.team_id) counts[row.team_id] = (counts[row.team_id] || 0) + 1
    }
  }

  return NextResponse.json({
    teams: list.map((t) => ({ ...t, player_count: counts[t.id] || 0 })),
    org_slug: org.slug,
    org_plan: normalizeOrgPlan(org.plan),
    org_role: access.role,
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only the league owner can create teams.' }, { status: 403 })
  }

  const { name, color, season_id } = await req.json()

  if (!name || !season_id) {
    return NextResponse.json({ error: 'Team name and season are required' }, { status: 400 })
  }

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('id', season_id)
    .eq('organization_id', access.organization.id)
    .maybeSingle()

  if (!season) {
    return NextResponse.json({ error: 'Season not found for this league.' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('teams')
    .insert({
      name,
      color: color || '#1d4ed8',
      season_id,
      organization_id: access.organization.id,
    })

  if (error) return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only the league owner can delete teams.' }, { status: 403 })
  }

  const { team_id } = await req.json()
  if (!team_id) return NextResponse.json({ error: 'team_id is required' }, { status: 400 })

  const { data: row, error: findErr } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', team_id)
    .eq('organization_id', access.organization.id)
    .maybeSingle()

  if (findErr || !row) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('teams').delete().eq('id', team_id).eq('organization_id', access.organization.id)

  if (error) return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 })
  return NextResponse.json({ success: true })
}