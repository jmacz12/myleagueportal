import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamManagerAccess } from '@/lib/team-manager-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  const { userId } = await auth()
  const { teamId, eventId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.title === 'string') patch.title = body.title.trim()
  if (typeof body?.starts_at === 'string') patch.starts_at = body.starts_at.trim()
  if (typeof body?.ends_at === 'string') patch.ends_at = body.ends_at.trim()
  if (typeof body?.location === 'string') patch.location = body.location.trim()
  if (typeof body?.notes === 'string') patch.notes = body.notes.trim()

  const { error } = await supabaseAdmin
    .from('team_calendar_events')
    .update(patch)
    .eq('id', eventId)
    .eq('team_id', teamId)
    .eq('organization_id', access.organizationId)

  if (error) return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  const { userId } = await auth()
  const { teamId, eventId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('team_calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('team_id', teamId)
    .eq('organization_id', access.organizationId)

  if (error) return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  return NextResponse.json({ success: true })
}
