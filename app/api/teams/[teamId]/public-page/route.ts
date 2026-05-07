import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getTeamManagerAccess } from '@/lib/team-manager-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeStreamUrl(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  try {
    const u = new URL(s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { stream_url?: string | null; house_rules?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, string | null> = {}
  if ('stream_url' in body) {
    const n = normalizeStreamUrl(body.stream_url ?? null)
    if (body.stream_url && body.stream_url.trim() && !n) {
      return NextResponse.json({ error: 'stream_url must be a valid http(s) URL' }, { status: 400 })
    }
    update.stream_url = n
  }
  if ('house_rules' in body) {
    if (body.house_rules == null || String(body.house_rules).trim() === '') {
      update.house_rules = null
    } else {
      update.house_rules = String(body.house_rules).trim().slice(0, 12000)
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('teams').update(update).eq('id', teamId)

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('stream_url') || msg.includes('house_rules') || msg.includes('column')) {
      return NextResponse.json(
        { error: 'Database missing stream_url/house_rules columns. Apply pending migrations.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
