import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { pollId } = await params
  const body = await req.json()
  const action = body?.action as string | undefined

  if (action !== 'close') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: poll, error: fetchError } = await supabaseAdmin
    .from('jersey_polls')
    .select('id, organization_id, status')
    .eq('id', pollId)
    .single()

  if (fetchError || !poll || poll.organization_id !== org.id) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  if (poll.status === 'closed') {
    return NextResponse.json({ error: 'Poll is already closed' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('jersey_polls')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', pollId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to close poll' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
