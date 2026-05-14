import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: standings } = await supabaseAdmin
    .from('player_reputation')
    .select('*, players(full_name, email)')
    .eq('organization_id', gate.organizationId)
    .order('points', { ascending: false })

  return NextResponse.json({ standings: standings || [] })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { player_id, points_change, reason, inactive_action } = await req.json()

  if (inactive_action) {
    if (inactive_action === 'keep') {
      await supabaseAdmin.from('player_reputation')
        .update({ is_inactive: false, consecutive_noshows: 0 })
        .eq('player_id', player_id).eq('organization_id', gate.organizationId)
    } else if (inactive_action === 'remove') {
      await supabaseAdmin.from('players').delete()
        .eq('id', player_id).eq('organization_id', gate.organizationId)
    }
    return NextResponse.json({ success: true })
  }

  // Adjust points
  const { data: current } = await supabaseAdmin
    .from('player_reputation')
    .select('points')
    .eq('player_id', player_id)
    .eq('organization_id', gate.organizationId)
    .single()

  const newPoints = (current?.points || 0) + points_change

  // Recalculate tier
  const { data: settings } = await supabaseAdmin
    .from('reputation_settings')
    .select('tier_gold, tier_silver')
    .eq('organization_id', gate.organizationId)
    .single()

  const goldThreshold = settings?.tier_gold || 200
  const silverThreshold = settings?.tier_silver || 100
  const tier = newPoints >= goldThreshold ? 'gold'
    : newPoints >= silverThreshold ? 'silver'
    : newPoints < 0 ? 'warning' : 'bronze'

  await supabaseAdmin.from('player_reputation')
    .update({ points: newPoints, tier })
    .eq('player_id', player_id).eq('organization_id', gate.organizationId)

  await supabaseAdmin.from('reputation_log').insert({
    organization_id: gate.organizationId,
    player_id,
    points_change,
    reason,
    created_by: userId,
  })

  return NextResponse.json({ success: true })
}