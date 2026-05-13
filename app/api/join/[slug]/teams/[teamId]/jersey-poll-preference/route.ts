import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'
import { jerseyPollsEnabledForOrgPlan, JERSEY_POLL_PRO_REQUIRED_MESSAGE } from '@/lib/jersey-poll-tier'
import { getJerseyPollSelfPayload } from '@/lib/jersey-poll-self'
import { upsertJerseyPollPlayerResponse } from '@/lib/jersey-poll-response'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Signed-in roster player: save preferred jersey number for this team’s open poll (Overview tab). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to save your jersey number pick.' }, { status: 401 })
  }

  const { slug: slugRaw, teamId } = await params
  const slug = normalizeJoinSlugParam(slugRaw)
  if (!slug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  let body: { preferred_number?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const preferred = body?.preferred_number
  if (preferred === undefined || preferred === null) {
    return NextResponse.json({ error: 'preferred_number is required.' }, { status: 400 })
  }
  const parsed = parseInt(String(preferred), 10)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) {
    return NextResponse.json({ error: 'Jersey number must be between 0 and 99.' }, { status: 400 })
  }

  const orgHub = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!orgHub?.id) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  if (!jerseyPollsEnabledForOrgPlan(orgHub.plan)) {
    return NextResponse.json({ error: JERSEY_POLL_PRO_REQUIRED_MESSAGE }, { status: 403 })
  }

  const { data: team, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, organization_id')
    .eq('id', teamId)
    .maybeSingle()

  if (teamErr || !team || team.organization_id !== orgHub.id) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  const { data: poll, error: pollErr } = await supabaseAdmin
    .from('jersey_polls')
    .select('id, team_id, organization_id, status')
    .eq('team_id', teamId)
    .eq('status', 'open')
    .maybeSingle()

  if (pollErr || !poll || poll.organization_id !== orgHub.id) {
    return NextResponse.json({ error: 'No open jersey poll for this team.' }, { status: 404 })
  }

  const self = await getJerseyPollSelfPayload(supabaseAdmin, {
    userId,
    teamId,
    pollId: poll.id,
  })

  if (!self.player_id) {
    return NextResponse.json(
      {
        error:
          'We could not match your signed-in account to a player on this roster. Use the same email you used for season registration, or ask your organizer.',
      },
      { status: 403 }
    )
  }

  const result = await upsertJerseyPollPlayerResponse(supabaseAdmin, {
    pollId: poll.id,
    playerId: self.player_id,
    preferredNumber: parsed,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ success: true, preferred_number: parsed })
}
