import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import {
  type SeasonSignupMode,
  buildSeasonSignupRowFromMode,
} from '@/lib/seasonSignup'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LIMITS: Record<string, number> = {
  basic: 1,
  pro: 3,
  enterprise: 99999,
}

/** PostgREST expects plain YYYY-MM-DD for date columns; clients may send ISO timestamps. */
function parseDateOnlyInput(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') return null
  const head = v.trim().slice(0, 10)
  const isoish = /^\d{4}-\d{1,2}-\d{1,2}$/.test(head)
  const d = isoish ? new Date(head + 'T12:00:00') : new Date(v)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function resolveSeasonsOrg(userId: string) {
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return null
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .single()
  return org
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const org = await resolveSeasonsOrg(userId)
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { data: seasons } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    seasons: seasons || [],
    orgInfo: {
      plan: org.plan,
      seasonLimit: PLAN_LIMITS[org.plan] ?? 1,
    }
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const org = await resolveSeasonsOrg(userId)
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const limit = PLAN_LIMITS[org.plan] ?? 1
  const { count: seasonCount } = await supabaseAdmin
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  if ((seasonCount ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Your ${org.plan} plan allows a maximum of ${limit} season(s). Upgrade to create more.` },
      { status: 403 }
    )
  }

  const {
    name,
    start_date,
    end_date,
    signup_opens_mode,
    signup_opens_days_before,
    online_registration_opens_at,
    online_registration_closes_at,
  } = await req.json()
  if (!name) return NextResponse.json({ error: 'Season name is required' }, { status: 400 })

  const parseTs = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v !== 'string') return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const mode = (signup_opens_mode || 'open_now') as SeasonSignupMode
  const startYmd = parseDateOnlyInput(start_date)
  const signupRow = buildSeasonSignupRowFromMode(mode, {
    start_date: startYmd,
    signup_opens_days_before,
    customOpensIso: parseTs(online_registration_opens_at),
    closesIso: parseTs(online_registration_closes_at),
  })

  const insertRow: Record<string, unknown> = {
    name,
    type: 'season',
    start_date: parseDateOnlyInput(start_date),
    end_date: parseDateOnlyInput(end_date),
    organization_id: org.id,
    is_active: true,
    ...signupRow,
  }

  let { error } = await supabaseAdmin.from('seasons').insert(insertRow)

  if (error && String(error.message || '').includes('allow_online_registration')) {
    delete insertRow.allow_online_registration
    delete insertRow.online_registration_opens_at
    delete insertRow.online_registration_closes_at
    delete insertRow.signup_opens_mode
    delete insertRow.signup_opens_days_before
    const retry = await supabaseAdmin.from('seasons').insert(insertRow)
    error = retry.error
  }

  if (error && String(error.message || '').includes('online_registration_')) {
    delete insertRow.online_registration_opens_at
    delete insertRow.online_registration_closes_at
    const retry = await supabaseAdmin.from('seasons').insert(insertRow)
    error = retry.error
  }

  if (error && String(error.message || '').includes('signup_opens')) {
    delete insertRow.signup_opens_mode
    delete insertRow.signup_opens_days_before
    const retry = await supabaseAdmin.from('seasons').insert(insertRow)
    error = retry.error
  }

  if (error) return NextResponse.json({ error: 'Failed to create season' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const org = await resolveSeasonsOrg(userId)
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const {
    season_id,
    name,
    start_date,
    end_date,
    is_active,
    allow_online_registration,
    signup_opens_mode,
    signup_opens_days_before,
    online_registration_opens_at,
    online_registration_closes_at,
  } = await req.json()
  const seasonId = typeof season_id === 'string' ? season_id.trim() : ''
  if (!seasonId) return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  const seasonSelectFull =
    'id, organization_id, start_date, end_date, signup_opens_mode, signup_opens_days_before, allow_online_registration, online_registration_opens_at, online_registration_closes_at'
  const seasonSelectLegacy =
    'id, organization_id, start_date, end_date, allow_online_registration, online_registration_opens_at, online_registration_closes_at'

  const { data: existingInResolvedOrgRows, error: existingInResolvedOrgError } = await supabaseAdmin
    .from('seasons')
    .select(seasonSelectFull)
    .eq('id', seasonId as never)
    .eq('organization_id', org.id)
    .limit(1)
  let existingInResolvedOrg = existingInResolvedOrgRows?.[0] ?? null
  if (existingInResolvedOrgError) {
    const msg = String(existingInResolvedOrgError.message || '')
    const missingSignupCols =
      msg.includes('signup_opens_mode') || msg.includes('signup_opens_days_before')
    if (missingSignupCols) {
      const { data: fallbackRows, error: fallbackErr } = await supabaseAdmin
        .from('seasons')
        .select(seasonSelectLegacy)
        .eq('id', seasonId as never)
        .eq('organization_id', org.id)
        .limit(1)
      if (fallbackErr) {
        return NextResponse.json(
          { error: `Season lookup failed: ${fallbackErr.message}` },
          { status: 500 }
        )
      }
      const row = fallbackRows?.[0]
      existingInResolvedOrg = row
        ? {
            ...row,
            signup_opens_mode: null,
            signup_opens_days_before: null,
          }
        : null
    } else {
      return NextResponse.json(
        { error: `Season lookup failed: ${existingInResolvedOrgError.message}` },
        { status: 500 }
      )
    }
  }
  let existing = existingInResolvedOrg
  if (!existing) {
    const { data: existingAnyRows, error: existingAnyError } = await supabaseAdmin
      .from('seasons')
      .select(seasonSelectFull)
      .eq('id', seasonId as never)
      .limit(1)
    let existingAny = existingAnyRows?.[0] ?? null
    if (existingAnyError) {
      const msg = String(existingAnyError.message || '')
      const missingSignupCols =
        msg.includes('signup_opens_mode') || msg.includes('signup_opens_days_before')
      if (missingSignupCols) {
        const { data: fallbackRows, error: fallbackErr } = await supabaseAdmin
          .from('seasons')
          .select(seasonSelectLegacy)
          .eq('id', seasonId as never)
          .limit(1)
        if (fallbackErr) {
          return NextResponse.json(
            { error: `Season lookup failed: ${fallbackErr.message}` },
            { status: 500 }
          )
        }
        const fb = fallbackRows?.[0]
        existingAny = fb
          ? {
              ...fb,
              signup_opens_mode: null,
              signup_opens_days_before: null,
            }
          : null
      } else {
        return NextResponse.json(
          { error: `Season lookup failed: ${existingAnyError.message}` },
          { status: 500 }
        )
      }
    }
    if (!existingAny) {
      return NextResponse.json(
        { error: `Season not found (season_id=${seasonId}, resolved_org=${org.id})` },
        { status: 404 }
      )
    }

    const [{ data: ownedOrg }, { data: editorAccess }] = await Promise.all([
      supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', existingAny.organization_id)
        .eq('clerk_user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('organization_editors')
        .select('organization_id')
        .eq('organization_id', existingAny.organization_id)
        .eq('clerk_user_id', userId)
        .maybeSingle(),
    ])
    if (!ownedOrg && !editorAccess) {
      return NextResponse.json(
        {
          error: `Season not found (no access season_org=${existingAny.organization_id}, resolved_org=${org.id})`,
        },
        { status: 404 }
      )
    }
    existing = existingAny
  }

  const parseTs = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v !== 'string') return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const update: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) update.name = name.trim()
  if (typeof is_active === 'boolean') update.is_active = is_active

  const mergedStart =
    start_date !== undefined
      ? parseDateOnlyInput(start_date)
      : parseDateOnlyInput(existing.start_date)

  const existingMode =
    ((existing as Record<string, unknown>).signup_opens_mode as SeasonSignupMode | undefined) ||
    (existing.allow_online_registration === false ? 'closed' : 'open_now')

  const signupDetailTouch =
    signup_opens_mode !== undefined ||
    signup_opens_days_before !== undefined ||
    online_registration_opens_at !== undefined ||
    online_registration_closes_at !== undefined

  if (signupDetailTouch) {
    const mode = (signup_opens_mode || existingMode) as SeasonSignupMode
    const closesIso =
      online_registration_closes_at !== undefined
        ? parseTs(online_registration_closes_at)
        : parseTs(existing.online_registration_closes_at as string | null)
    const days =
      signup_opens_days_before !== undefined
        ? signup_opens_days_before
        : ((existing as Record<string, unknown>).signup_opens_days_before as number | null | undefined)
    let customOpens: string | null = null
    if (mode === 'custom') {
      customOpens =
        online_registration_opens_at !== undefined
          ? parseTs(online_registration_opens_at)
          : parseTs(existing.online_registration_opens_at as string | null)
    }
    Object.assign(
      update,
      buildSeasonSignupRowFromMode(mode, {
        start_date: mergedStart,
        signup_opens_days_before: days,
        customOpensIso: customOpens,
        closesIso,
      })
    )
  } else if (typeof allow_online_registration === 'boolean') {
    const mode: SeasonSignupMode = allow_online_registration ? 'open_now' : 'closed'
    Object.assign(
      update,
      buildSeasonSignupRowFromMode(mode, {
        start_date: mergedStart,
        signup_opens_days_before: (existing as Record<string, unknown>)
          .signup_opens_days_before as number | null | undefined,
        customOpensIso: null,
        closesIso: parseTs(existing.online_registration_closes_at as string | null),
      })
    )
  } else if ((start_date !== undefined || end_date !== undefined) && existingMode === 'scheduled') {
    Object.assign(
      update,
      buildSeasonSignupRowFromMode('scheduled', {
        start_date: mergedStart,
        signup_opens_days_before:
          ((existing as Record<string, unknown>).signup_opens_days_before as number | null | undefined) ??
          3,
        customOpensIso: null,
        closesIso: parseTs(existing.online_registration_closes_at as string | null),
      })
    )
  }

  // Always persist season calendar dates / rename when provided (after signup row merge).
  if (start_date !== undefined) update.start_date = parseDateOnlyInput(start_date)
  if (end_date !== undefined) update.end_date = parseDateOnlyInput(end_date)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  let { error } = await supabaseAdmin
    .from('seasons')
    .update(update)
    .eq('id', seasonId)
    .eq('organization_id', existing.organization_id)

  if (error && String(error.message || '').includes('allow_online_registration')) {
    delete update.allow_online_registration
    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Run the database migration for online season signup (allow_online_registration).' },
        { status: 500 }
      )
    }
    const retry = await supabaseAdmin
      .from('seasons')
      .update(update)
      .eq('id', seasonId)
      .eq('organization_id', existing.organization_id)
    error = retry.error
  }

  if (error && String(error.message || '').includes('online_registration_')) {
    delete update.online_registration_opens_at
    delete update.online_registration_closes_at
    const retry = await supabaseAdmin
      .from('seasons')
      .update(update)
      .eq('id', seasonId)
      .eq('organization_id', existing.organization_id)
    error = retry.error
  }

  if (error && String(error.message || '').includes('signup_opens')) {
    delete update.signup_opens_mode
    delete update.signup_opens_days_before
    const retry = await supabaseAdmin
      .from('seasons')
      .update(update)
      .eq('id', seasonId)
      .eq('organization_id', existing.organization_id)
    error = retry.error
  }

  if (error) {
    return NextResponse.json(
      { error: `Failed to update season: ${error.message || 'Unknown database error'}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const org = await resolveSeasonsOrg(userId)
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { season_id } = await req.json()
  if (!season_id) return NextResponse.json({ error: 'season_id is required' }, { status: 400 })

  const { data: row } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('id', season_id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

  const { error } = await supabaseAdmin.from('seasons').delete().eq('id', season_id)

  if (error) return NextResponse.json({ error: 'Failed to delete season' }, { status: 500 })
  return NextResponse.json({ success: true })
}