import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { jerseyPollsEnabledForOrgPlan, JERSEY_POLL_PRO_REQUIRED_MESSAGE } from '@/lib/jersey-poll-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PollResponse = {
  player_id: string
  preferred_number: number
  submitted_at: string
  player: { full_name: string; team_id: string | null }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  if (!jerseyPollsEnabledForOrgPlan(org.plan)) {
    return NextResponse.json({ polls: [], jersey_polls_tier: 'basic' as const })
  }

  const { data: polls, error } = await supabaseAdmin
    .from('jersey_polls')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load polls' }, { status: 500 })

  const pollIds = (polls || []).map((p) => p.id)
  if (pollIds.length === 0) {
    return NextResponse.json({ polls: [] })
  }

  const { data: rawResponses } = await supabaseAdmin
    .from('jersey_poll_responses')
    .select('poll_id, player_id, preferred_number, submitted_at, players(full_name, team_id)')
    .in('poll_id', pollIds)

  const byPoll = new Map<string, PollResponse[]>()
  for (const row of rawResponses || []) {
    const rawPl = row.players as unknown
    const plRow = Array.isArray(rawPl) ? rawPl[0] : rawPl
    const pl = plRow as { full_name: string; team_id: string | null } | null | undefined
    const entry: PollResponse = {
      player_id: row.player_id,
      preferred_number: row.preferred_number,
      submitted_at: row.submitted_at,
      player: pl ?? { full_name: 'Unknown', team_id: null },
    }
    const list = byPoll.get(row.poll_id) || []
    list.push(entry)
    byPoll.set(row.poll_id, list)
  }

  const teamIds = [...new Set((polls || []).map((p) => p.team_id as string))]
  const playersByTeam = new Map<string, { id: string; full_name: string }[]>()

  if (teamIds.length > 0) {
    const { data: allPlayers } = await supabaseAdmin
      .from('players')
      .select('id, full_name, team_id')
      .in('team_id', teamIds)

    for (const tp of allPlayers || []) {
      const tid = tp.team_id as string
      const row = { id: tp.id as string, full_name: String(tp.full_name || 'Player') }
      const arr = playersByTeam.get(tid) || []
      arr.push(row)
      playersByTeam.set(tid, arr)
    }
    for (const arr of playersByTeam.values()) {
      arr.sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }))
    }
  }

  const enriched = (polls || []).map((p) => {
    const list = (byPoll.get(p.id) || []).filter((r) => r.player.team_id === p.team_id)
    const prefByPlayer = new Map(list.map((r) => [r.player_id, r.preferred_number]))
    const teamPlayers = playersByTeam.get(p.team_id as string) || []
    const submissions = teamPlayers.map((tp) => ({
      player_id: tp.id,
      full_name: tp.full_name,
      preferred_number: prefByPlayer.has(tp.id) ? Number(prefByPlayer.get(tp.id)) : null,
    }))
    return {
      ...p,
      submissions,
    }
  })

  return NextResponse.json({ polls: enriched })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  if (!jerseyPollsEnabledForOrgPlan(org.plan)) {
    return NextResponse.json({ error: JERSEY_POLL_PRO_REQUIRED_MESSAGE }, { status: 403 })
  }

  const { team_id } = await req.json()
  if (!team_id) {
    return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, season_id, organization_id')
    .eq('id', team_id)
    .single()

  if (teamError || !team || team.organization_id !== org.id) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  const { data: existing } = await supabaseAdmin
    .from('jersey_polls')
    .select('id')
    .eq('team_id', team_id)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This team already has an open jersey poll. Close it before starting a new one.' },
      { status: 409 }
    )
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from('jersey_polls')
    .insert({
      organization_id: org.id,
      team_id: team.id,
      season_id: team.season_id,
      status: 'open',
    })
    .select('id')
    .single()

  if (insertError || !created) {
    return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 })
  }

  return NextResponse.json({ poll_id: created.id })
}
