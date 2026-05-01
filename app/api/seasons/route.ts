import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LIMITS: Record<string, number> = {
  basic: 1,
  pro: 3,
  enterprise: 99999,
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    seasons: seasons || [],
    orgInfo: {
      plan: org.plan,
      seasonLimit: PLAN_LIMITS[org.plan] ?? 1,
    }
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const limit = PLAN_LIMITS[org.plan] ?? 1
  const { count: seasonCount } = await supabaseAdmin
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  if ((seasonCount ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Your ${org.plan} plan allows a maximum of ${limit} season(s). Upgrade to create more.` },
      { status: 403 }
    )
  }

  const { name, type, start_date, end_date } = await req.json()
  if (!name) return NextResponse.json({ error: 'Season name is required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('seasons')
    .insert({
      name,
      type: type || 'season',
      start_date: start_date || null,
      end_date: end_date || null,
      organization_id: org.id,
      is_active: true,
    })

  if (error) return NextResponse.json({ error: 'Failed to create season' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { season_id, is_active } = await req.json()

  const { error } = await supabaseAdmin
    .from('seasons')
    .update({ is_active })
    .eq('id', season_id)

  if (error) return NextResponse.json({ error: 'Failed to update season' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { season_id } = await req.json()

  const { error } = await supabaseAdmin
    .from('seasons')
    .delete()
    .eq('id', season_id)

  if (error) return NextResponse.json({ error: 'Failed to delete season' }, { status: 500 })
  return NextResponse.json({ success: true })
}