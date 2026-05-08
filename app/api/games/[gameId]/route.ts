import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params

  const { data: game } = await supabaseAdmin
    .from('games').select('*').eq('id', gameId).single()

  return NextResponse.json({ game })
}

function parseStarterSlots(raw: unknown): (string | null)[] {
  const base: (string | null)[] = [null, null, null, null, null]
  if (!Array.isArray(raw)) return base
  for (let i = 0; i < 5; i++) {
    const v = raw[i]
    if (v === null || v === undefined || v === '') base[i] = null
    else if (typeof v === 'string' && v.length > 0) base[i] = v
    else base[i] = null
  }
  return base
}

async function validateStarterSlots(
  teamId: string | null,
  slots: unknown
): Promise<(string | null)[]> {
  const parsed = parseStarterSlots(slots)
  if (!teamId) return parsed
  const ids = parsed.filter((x): x is string => !!x)
  if (ids.length === 0) return parsed
  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id')
    .in('id', ids)
    .eq('team_id', teamId)
  const ok = new Set((players || []).map((p) => p.id))
  return parsed.map((id) => (id && ok.has(id) ? id : null))
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { gameId } = await params
  const body = await req.json()

  const { data: gameRow } = await supabaseAdmin
    .from('games')
    .select('organization_id, home_team_id, away_team_id')
    .eq('id', gameId)
    .single()

  if (!gameRow || gameRow.organization_id !== org.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (body.game_clock !== undefined) updates.game_clock = body.game_clock
  if (body.period !== undefined) updates.period = body.period
  if (body.home_score !== undefined) updates.home_score = body.home_score
  if (body.away_score !== undefined) updates.away_score = body.away_score
  if (body.status !== undefined) updates.status = body.status
  if (body.home_starter_slot_ids !== undefined) {
    updates.home_starter_slot_ids = await validateStarterSlots(
      gameRow.home_team_id,
      body.home_starter_slot_ids
    )
  }
  if (body.away_starter_slot_ids !== undefined) {
    updates.away_starter_slot_ids = await validateStarterSlots(
      gameRow.away_team_id,
      body.away_starter_slot_ids
    )
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('games').update(updates).eq('id', gameId)
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true })
}