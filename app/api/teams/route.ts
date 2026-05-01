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

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ teams: teams || [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { name, color, season_id } = await req.json()

  if (!name || !season_id) {
    return NextResponse.json({ error: 'Team name and season are required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('teams')
    .insert({
      name,
      color: color || '#1d4ed8',
      season_id,
      organization_id: org.id,
    })

  if (error) return NextResponse.json({ error: 'Failed to create team' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { team_id } = await req.json()

  const { error } = await supabaseAdmin
    .from('teams')
    .delete()
    .eq('id', team_id)

  if (error) return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 })
  return NextResponse.json({ success: true })
}