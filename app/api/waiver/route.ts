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

  const { data: waiver } = await supabaseAdmin
    .from('waivers')
    .select('id, title, content, is_active')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .single()

  return NextResponse.json({ waiver: waiver || null })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { title, content } = await req.json()

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  }

  // Check if a waiver already exists for this org
  const { data: existing } = await supabaseAdmin
    .from('waivers')
    .select('id')
    .eq('organization_id', org.id)
    .single()

  if (existing) {
    // Update existing waiver
    const { error } = await supabaseAdmin
      .from('waivers')
      .update({ title, content, is_active: true })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: 'Failed to save waiver' }, { status: 500 })
  } else {
    // Create new waiver
    const { error } = await supabaseAdmin
      .from('waivers')
      .insert({ organization_id: org.id, title, content, is_active: true })

    if (error) return NextResponse.json({ error: 'Failed to save waiver' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}