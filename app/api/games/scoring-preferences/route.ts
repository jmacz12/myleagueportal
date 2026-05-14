import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import {
  clampScoringQuarterMinutes,
  recomputeMinutesForAllOrgGames,
} from '@/lib/game-lineup-minutes'
import { normalizePublicPrimaryStatKeys } from '@/lib/public-primary-stats'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Game-clock + public fan stat picks (Dashboard → Games). */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: row, error } = await supabaseAdmin
    .from('organizations')
    .select('scoring_quarter_minutes, public_stream_primary_stat_keys')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('public_stream_primary_stat_keys')) {
      const { data: row2, error: err2 } = await supabaseAdmin
        .from('organizations')
        .select('scoring_quarter_minutes')
        .eq('id', access.organization.id)
        .maybeSingle()
      if (err2) return NextResponse.json({ error: 'Failed to load game preferences' }, { status: 500 })
      const scoring_quarter_minutes = clampScoringQuarterMinutes(
        (row2 as { scoring_quarter_minutes?: unknown } | null)?.scoring_quarter_minutes
      )
      return NextResponse.json({
        scoring_quarter_minutes,
        public_stream_primary_stat_keys: normalizePublicPrimaryStatKeys(null),
      })
    }
    return NextResponse.json({ error: 'Failed to load game preferences' }, { status: 500 })
  }

  const scoring_quarter_minutes = clampScoringQuarterMinutes(
    (row as { scoring_quarter_minutes?: unknown } | null)?.scoring_quarter_minutes
  )
  const public_stream_primary_stat_keys = normalizePublicPrimaryStatKeys(
    (row as { public_stream_primary_stat_keys?: unknown } | null)?.public_stream_primary_stat_keys
  )
  return NextResponse.json({ scoring_quarter_minutes, public_stream_primary_stat_keys })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const body = (await req.json().catch(() => null)) as {
    scoring_quarter_minutes?: unknown
    public_stream_primary_stat_keys?: unknown
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const hasQm = body.scoring_quarter_minutes !== undefined
  const hasPk = body.public_stream_primary_stat_keys !== undefined
  if (!hasQm && !hasPk) {
    return NextResponse.json(
      { error: 'Send scoring_quarter_minutes and/or public_stream_primary_stat_keys' },
      { status: 400 }
    )
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id, scoring_quarter_minutes, public_stream_primary_stat_keys')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (orgErr || !org?.id) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const orgRow = org as {
    scoring_quarter_minutes?: unknown
    public_stream_primary_stat_keys?: unknown
  }

  const updatePayload: Record<string, unknown> = {}

  let nextQm: number | undefined
  if (hasQm) {
    const prev = clampScoringQuarterMinutes(orgRow.scoring_quarter_minutes)
    nextQm = clampScoringQuarterMinutes(body.scoring_quarter_minutes)
    updatePayload.scoring_quarter_minutes = nextQm
  }

  let nextPrimary: ReturnType<typeof normalizePublicPrimaryStatKeys> | undefined
  if (hasPk) {
    nextPrimary = normalizePublicPrimaryStatKeys(body.public_stream_primary_stat_keys)
    updatePayload.public_stream_primary_stat_keys = nextPrimary
  }

  const { error: upErr } = await supabaseAdmin.from('organizations').update(updatePayload).eq('id', org.id)

  if (upErr) {
    const msg = String(upErr.message || '')
    if (msg.includes('scoring_quarter_minutes') || msg.includes('public_stream_primary_stat_keys')) {
      return NextResponse.json(
        { error: 'This setting is unavailable until the latest database migrations are applied.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to save game preferences' }, { status: 500 })
  }

  if (hasQm && nextQm !== undefined) {
    const prev = clampScoringQuarterMinutes(orgRow.scoring_quarter_minutes)
    if (prev !== nextQm) {
      await recomputeMinutesForAllOrgGames(supabaseAdmin, org.id)
    }
  }

  const outQm = hasQm
    ? clampScoringQuarterMinutes(nextQm)
    : clampScoringQuarterMinutes(orgRow.scoring_quarter_minutes)
  const outPrimary = hasPk
    ? nextPrimary!
    : normalizePublicPrimaryStatKeys(orgRow.public_stream_primary_stat_keys)

  return NextResponse.json({
    success: true,
    scoring_quarter_minutes: outQm,
    public_stream_primary_stat_keys: outPrimary,
  })
}
