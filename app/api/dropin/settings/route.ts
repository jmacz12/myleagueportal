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

  let { data: settings } = await supabaseAdmin
    .from('reputation_settings')
    .select('*')
    .eq('organization_id', gate.organizationId)
    .single()

  if (!settings) {
    const { data: newSettings } = await supabaseAdmin
      .from('reputation_settings')
      .insert({ organization_id: gate.organizationId })
      .select().single()
    settings = newSettings
  }

  return NextResponse.json({ settings })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const body = await req.json()

  await supabaseAdmin.from('reputation_settings')
    .upsert({ organization_id: gate.organizationId, ...body })

  return NextResponse.json({ success: true })
}