import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const org = { id: access.organization.id }

  const [{ data: players }, { data: orgRow }] = await Promise.all([
    supabaseAdmin
      .from('players')
      .select('*')
      .eq('organization_id', org.id)
      .order('registered_at', { ascending: false }),
    supabaseAdmin
      .from('organizations')
      .select('plan, game_email_reminders_enabled, fan_email_registration_opens_enabled')
      .eq('id', org.id)
      .single(),
  ])

  const orgPlan = normalizeOrgPlan(orgRow?.plan)
  const gameEmailRemindersEnabled =
    (orgRow as { game_email_reminders_enabled?: boolean } | null)?.game_email_reminders_enabled !==
    false
  const registrationOpensEnabled =
    (orgRow as { fan_email_registration_opens_enabled?: boolean } | null)
      ?.fan_email_registration_opens_enabled !== false

  return NextResponse.json({
    players: players || [],
    org_plan: orgPlan,
    game_email_reminders_enabled: gameEmailRemindersEnabled,
    fan_email_registration_opens_enabled: registrationOpensEnabled,
    game_reminders_available: isProOrEnterprise(orgPlan),
    fan_alerts_available: isProOrEnterprise(orgPlan),
  })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const org = { id: access.organization.id }

  const {
    player_id,
    team_id,
    jersey_number,
    game_reminders_opt_out,
    fan_email_registration_opens_opt_out,
  } = await req.json()
  if (!player_id) return NextResponse.json({ error: 'player_id is required' }, { status: 400 })

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id, season_id, organization_id')
    .eq('id', player_id)
    .single()

  if (!player || player.organization_id !== org.id) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (team_id !== undefined) update.team_id = team_id || null

  if (jersey_number !== undefined) {
    let n: number | null = null
    if (jersey_number === null || jersey_number === '') {
      n = null
    } else {
      const parsed = parseInt(String(jersey_number), 10)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) {
        return NextResponse.json({ error: 'Jersey number must be between 0 and 99.' }, { status: 400 })
      }
      n = parsed
    }

    if (n !== null) {
      const { data: conflict } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('season_id', player.season_id)
        .eq('jersey_number', n)
        .neq('id', player_id)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json(
          { error: 'That jersey number is already taken for this season.' },
          { status: 409 }
        )
      }
    }
    update.jersey_number = n
  }

  if (game_reminders_opt_out !== undefined) {
    update.game_reminders_opt_out = game_reminders_opt_out === true
  }
  if (fan_email_registration_opens_opt_out !== undefined) {
    update.fan_email_registration_opens_opt_out = fan_email_registration_opens_opt_out === true
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('players').update(update).eq('id', player_id)

  if (error) return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const org = { id: access.organization.id }

  const { player_id } = await req.json()
  if (!player_id) return NextResponse.json({ error: 'player_id is required' }, { status: 400 })

  const { data: row } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('id', player_id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const { error } = await supabaseAdmin.from('players').delete().eq('id', player_id)

  if (error) return NextResponse.json({ error: 'Failed to remove player' }, { status: 500 })
  return NextResponse.json({ success: true })
}