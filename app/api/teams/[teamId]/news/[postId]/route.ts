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
  { params }: { params: Promise<{ teamId: string; postId: string }> }
) {
  const { userId } = await auth()
  const { teamId, postId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.title === 'string') patch.title = body.title.trim()
  if (typeof body?.body === 'string') patch.body = body.body.trim()
  if (typeof body?.pinned === 'boolean') patch.pinned = body.pinned

  const { error } = await supabaseAdmin
    .from('team_news_posts')
    .update(patch)
    .eq('id', postId)
    .eq('team_id', teamId)
    .eq('organization_id', access.organizationId)

  if (error) return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; postId: string }> }
) {
  const { userId } = await auth()
  const { teamId, postId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('team_news_posts')
    .delete()
    .eq('id', postId)
    .eq('team_id', teamId)
    .eq('organization_id', access.organizationId)

  if (error) return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  return NextResponse.json({ success: true })
}
