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

  const { data: standings } = await supabaseAdmin
    .from('player_reputation')
    .select('*, players(full_name, email)')
    .eq('organization_id', org.id)
    .order('points', { ascending: false })

  return NextResponse.json({ standings: standings || [] })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { player_id, points_change, reason, inactive_action } = await req.json()

  if (inactive_action) {
    if (inactive_action === 'keep') {
      await supabaseAdmin.from('player_reputation')
        .update({ is_inactive: false, consecutive_noshows: 0 })
        .eq('player_id', player_id).eq('organization_id', org.id)
    } else if (inactive_action === 'remove') {
      await supabaseAdmin.from('players').delete()
        .eq('id', player_id).eq('organization_id', org.id)
    }
    return NextResponse.json({ success: true })
  }

  // Adjust points
  const { data: current } = await supabaseAdmin
    .from('player_reputation')
    .select('points')
    .eq('player_id', player_id)
    .eq('organization_id', org.id)
    .single()

  const newPoints = (current?.points || 0) + points_change

  // Recalculate tier
  const { data: settings } = await supabaseAdmin
    .from('reputation_settings')
    .select('tier_gold, tier_silver')
    .eq('organization_id', org.id)
    .single()

  const goldThreshold = settings?.tier_gold || 200
  const silverThreshold = settings?.tier_silver || 100
  const tier = newPoints >= goldThreshold ? 'gold'
    : newPoints >= silverThreshold ? 'silver'
    : newPoints < 0 ? 'warning' : 'bronze'

  await supabaseAdmin.from('player_reputation')
    .update({ points: newPoints, tier })
    .eq('player_id', player_id).eq('organization_id', org.id)

  await supabaseAdmin.from('reputation_log').insert({
    organization_id: org.id,
    player_id,
    points_change,
    reason,
    created_by: userId,
  })

  return NextResponse.json({ success: true })
}