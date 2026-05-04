import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: players } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('organization_id', org.id)
    .order('registered_at', { ascending: false })

  return NextResponse.json({ players: players || [] })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { player_id, team_id, jersey_number } = await req.json()
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

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

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