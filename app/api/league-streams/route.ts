import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { normalizeStreamUrl } from '@/lib/stream-url'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireOwnerOrg(userId: string) {
  const access = await getOrgAccessForClerkUser(userId)
  if (!access || access.role !== 'owner') return null
  return access
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await requireOwnerOrg(userId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let defaultStreamUrl: string | null = null
  const orgQ = await supabaseAdmin
    .from('organizations')
    .select('default_stream_url')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!orgQ.error && orgQ.data && typeof (orgQ.data as { default_stream_url?: unknown }).default_stream_url === 'string') {
    defaultStreamUrl = normalizeStreamUrl((orgQ.data as { default_stream_url: string }).default_stream_url)
  }

  const { data: teams, error: teamsErr } = await supabaseAdmin
    .from('teams')
    .select('id, name, stream_url')
    .eq('organization_id', access.organization.id)
    .order('name', { ascending: true })

  if (teamsErr) {
    const msg = String(teamsErr.message || '')
    if (msg.includes('stream_url')) {
      const fb = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .eq('organization_id', access.organization.id)
        .order('name', { ascending: true })
      return NextResponse.json({
        defaultStreamUrl,
        teams: (fb.data || []).map((t) => ({ ...t, stream_url: null as string | null })),
      })
    }
    return NextResponse.json({ error: 'Could not load teams' }, { status: 500 })
  }

  return NextResponse.json({
    defaultStreamUrl,
    teams: (teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      stream_url: t.stream_url ?? null,
    })),
  })
}

type PatchBody = {
  defaultStreamUrl?: string | null
  teamStreams?: { teamId: string; streamUrl: string | null }[]
  applyDefaultToAllTeams?: boolean
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await requireOwnerOrg(userId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const hasPatch =
    typeof body.defaultStreamUrl !== 'undefined' ||
    body.applyDefaultToAllTeams === true ||
    (Array.isArray(body.teamStreams) && body.teamStreams.length > 0)
  if (!hasPatch) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const orgId = access.organization.id

  if (typeof body.defaultStreamUrl !== 'undefined') {
    const n = normalizeStreamUrl(body.defaultStreamUrl ?? null)
    if (body.defaultStreamUrl && String(body.defaultStreamUrl).trim() && !n) {
      return NextResponse.json({ error: 'defaultStreamUrl must be a valid http(s) URL' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ default_stream_url: n })
      .eq('id', orgId)
    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('default_stream_url') || msg.includes('column')) {
        return NextResponse.json(
          { error: 'Database missing default_stream_url. Apply pending migrations.' },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: 'Could not save league stream URL' }, { status: 500 })
    }
  }

  if (body.applyDefaultToAllTeams) {
    let toApply: string | null = null
    if (typeof body.defaultStreamUrl !== 'undefined') {
      toApply = normalizeStreamUrl(body.defaultStreamUrl ?? null)
      if (body.defaultStreamUrl != null && String(body.defaultStreamUrl).trim() && !toApply) {
        return NextResponse.json({ error: 'defaultStreamUrl must be a valid http(s) URL' }, { status: 400 })
      }
    }
    if (!toApply) {
      const { data: orgRow } = await supabaseAdmin
        .from('organizations')
        .select('default_stream_url')
        .eq('id', orgId)
        .maybeSingle()
      const raw = (orgRow as { default_stream_url?: string | null } | null)?.default_stream_url
      toApply = normalizeStreamUrl(raw ?? null)
    }
    const { error } = await supabaseAdmin.from('teams').update({ stream_url: toApply }).eq('organization_id', orgId)
    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('stream_url')) {
        return NextResponse.json({ error: 'Database missing stream_url on teams.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Could not apply URL to teams' }, { status: 500 })
    }
  }

  if (Array.isArray(body.teamStreams)) {
    for (const row of body.teamStreams) {
      if (!row?.teamId || typeof row.teamId !== 'string') continue
      const n = normalizeStreamUrl(row.streamUrl ?? null)
      if (row.streamUrl && String(row.streamUrl).trim() && !n) {
        return NextResponse.json({ error: `Invalid stream URL for team ${row.teamId}` }, { status: 400 })
      }
      const { data: teamCheck } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('id', row.teamId)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!teamCheck) continue

      const { error } = await supabaseAdmin.from('teams').update({ stream_url: n }).eq('id', row.teamId)
      if (error) {
        return NextResponse.json({ error: 'Could not update a team stream URL' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
