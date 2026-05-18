import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { demoPlanSwitcherAllowed, parseDemoPlanSwitch } from '@/lib/demo-plan-switcher'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can change the demo plan.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const plan = parseDemoPlanSwitch(body.plan)
  if (!plan) {
    return NextResponse.json({ error: 'Plan must be basic, pro, or enterprise.' }, { status: 400 })
  }

  const { data: org, error: loadErr } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, plan_complimentary')
    .eq('id', access.organization.id)
    .single()

  if (loadErr || !org) {
    return NextResponse.json({ error: 'Could not load league.' }, { status: 500 })
  }

  const complimentary = org.plan_complimentary === true
  if (!demoPlanSwitcherAllowed(org.slug, complimentary)) {
    return NextResponse.json({ error: 'Demo plan switcher is not enabled for this league.' }, { status: 403 })
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('organizations')
    .update({
      plan,
      plan_complimentary: true,
    })
    .eq('id', org.id)
    .select('slug, plan, plan_complimentary')
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: updateErr?.message || 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    org: updated,
    demo_plan_switcher_enabled: demoPlanSwitcherAllowed(updated.slug, updated.plan_complimentary === true),
  })
}
