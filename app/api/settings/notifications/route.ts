import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { isProOrEnterprise } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can manage notification settings.' }, { status: 403 })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const body = await req.json()
  const updateData: Record<string, unknown> = {}

  if (!isProOrEnterprise(org.plan)) {
    return NextResponse.json(
      { error: 'Fan email alerts are available on Pro and Enterprise plans.' },
      { status: 403 }
    )
  }

  const boolFields = [
    'game_email_reminders_enabled',
    'fan_email_registration_opens_enabled',
    'fan_email_dropin_reminders_enabled',
    'fan_email_news_publish_enabled',
    'fan_email_stats_highlights_enabled',
  ] as const

  for (const key of boolFields) {
    if (typeof body[key] === 'boolean') updateData[key] = body[key]
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No notification settings to update.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('organizations').update(updateData).eq('id', org.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to save notification settings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
