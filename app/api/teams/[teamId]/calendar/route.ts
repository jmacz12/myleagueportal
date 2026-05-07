import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamManagerAccess } from '@/lib/team-manager-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { userId } = await auth()
  const { teamId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const nowIso = new Date().toISOString()
  const [{ data: upcoming }, { data: recent }] = await Promise.all([
    supabaseAdmin
      .from('team_calendar_events')
      .select('id, title, starts_at, ends_at, location, notes, source')
      .eq('team_id', teamId)
      .eq('organization_id', access.organizationId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(20),
    supabaseAdmin
      .from('team_calendar_events')
      .select('id, title, starts_at, ends_at, location, notes, source')
      .eq('team_id', teamId)
      .eq('organization_id', access.organizationId)
      .lt('starts_at', nowIso)
      .order('starts_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({ upcoming: upcoming || [], recent: recent || [] })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { userId } = await auth()
  const { teamId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const title = String(body?.title || '').trim()
  const startsAt = String(body?.starts_at || '').trim()
  const endsAt = body?.ends_at ? String(body.ends_at).trim() : null
  const location = body?.location ? String(body.location).trim() : null
  const notes = body?.notes ? String(body.notes).trim() : null
  if (!title || !startsAt) {
    return NextResponse.json({ error: 'Title and start date/time are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('team_calendar_events')
    .insert({
      organization_id: access.organizationId,
      team_id: teamId,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      location,
      notes,
      source: 'manual',
      created_by_clerk_user_id: userId,
    })
    .select('id, title, starts_at, ends_at, location, notes, source')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  return NextResponse.json({ event: data })
}
