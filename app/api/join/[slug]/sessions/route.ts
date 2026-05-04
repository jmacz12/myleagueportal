import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // 1. Get Organization ID from Slug
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // 2. Fetch Active Upcoming Sessions
  const { data: sessions, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  return NextResponse.json({ sessions })
}