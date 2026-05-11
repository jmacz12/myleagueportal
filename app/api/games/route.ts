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
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: games } = await supabaseAdmin
    .from('games').select('*')
    .eq('organization_id', org.id)
    .order('scheduled_at', { ascending: true })

  return NextResponse.json({ games: games || [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { games, season_id } = await req.json() as {
    games: Array<{
      home_team_id?: string | null
      away_team_id?: string | null
      date?: string
      time?: string
      location?: string | null
    }>
    season_id: string
  }

  const inserts = games.map((g) => ({
    organization_id: org.id,
    season_id,
    home_team_id: g.home_team_id || null,
    away_team_id: g.away_team_id || null,
    scheduled_at: g.date && g.time ? `${g.date}T${g.time}:00` : null,
    location: g.location || null,
    status: 'scheduled',
  }))

  const { error } = await supabaseAdmin.from('games').insert(inserts)
  if (error) return NextResponse.json({ error: 'Failed to create games' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { game_id, status, home_score, away_score } = await req.json()

  const updates: Record<string, string | number | undefined> = {}
  if (status !== undefined) updates.status = status
  if (home_score !== undefined) updates.home_score = home_score
  if (away_score !== undefined) updates.away_score = away_score

  const { error } = await supabaseAdmin.from('games').update(updates).eq('id', game_id)
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { game_id } = await req.json()
  const { error } = await supabaseAdmin.from('games').delete().eq('id', game_id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  return NextResponse.json({ success: true })
}