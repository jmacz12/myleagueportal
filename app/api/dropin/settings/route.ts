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

  let { data: settings } = await supabaseAdmin
    .from('reputation_settings')
    .select('*')
    .eq('organization_id', org.id)
    .single()

  if (!settings) {
    const { data: newSettings } = await supabaseAdmin
      .from('reputation_settings')
      .insert({ organization_id: org.id })
      .select().single()
    settings = newSettings
  }

  return NextResponse.json({ settings })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  await supabaseAdmin.from('reputation_settings')
    .upsert({ organization_id: org.id, ...body })

  return NextResponse.json({ success: true })
}