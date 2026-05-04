import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Organizer-only: list waiver signatures for CSV export / audit. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: rows, error } = await supabaseAdmin
    .from('waiver_signatures')
    .select('id, full_name, email, signed_at, ip_address, waiver_id')
    .eq('organization_id', org.id)
    .order('signed_at', { ascending: false })

  if (error) {
    console.error('waiver_signatures', error)
    return NextResponse.json({ error: 'Failed to load signatures' }, { status: 500 })
  }

  const waiverIds = [...new Set((rows || []).map((r) => r.waiver_id).filter(Boolean))]
  let titleById: Record<string, string> = {}
  if (waiverIds.length > 0) {
    const { data: waivers } = await supabaseAdmin
      .from('waivers')
      .select('id, title')
      .in('id', waiverIds as string[])
    titleById = Object.fromEntries((waivers || []).map((w) => [w.id, w.title]))
  }

  const signatures = (rows || []).map((r) => ({
    ...r,
    waiver_title: r.waiver_id ? titleById[r.waiver_id as string] || '' : '',
  }))

  return NextResponse.json({ signatures })
}
