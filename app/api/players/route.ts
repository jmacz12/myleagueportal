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

  const { player_id, team_id } = await req.json()

  const { error } = await supabaseAdmin
    .from('players')
    .update({ team_id: team_id || null })
    .eq('id', player_id)

  if (error) return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { player_id } = await req.json()

  const { error } = await supabaseAdmin
    .from('players')
    .delete()
    .eq('id', player_id)

  if (error) return NextResponse.json({ error: 'Failed to remove player' }, { status: 500 })
  return NextResponse.json({ success: true })
}