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

  const { data, error } = await supabaseAdmin
    .from('team_news_posts')
    .select('id, title, body, pinned, created_at, updated_at')
    .eq('team_id', teamId)
    .eq('organization_id', access.organizationId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load team news' }, { status: 500 })
  return NextResponse.json({ posts: data || [] })
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
  const content = String(body?.body || '').trim()
  const pinned = Boolean(body?.pinned)
  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('team_news_posts')
    .insert({
      organization_id: access.organizationId,
      team_id: teamId,
      title,
      body: content,
      pinned,
      created_by_clerk_user_id: userId,
    })
    .select('id, title, body, pinned, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create news post' }, { status: 500 })
  return NextResponse.json({ post: data })
}
