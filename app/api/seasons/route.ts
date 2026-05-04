import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LIMITS: Record<string, number> = {
  basic: 1,
  pro: 3,
  enterprise: 99999,
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

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

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

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
    allow_online_registration,
    online_registration_opens_at,
    online_registration_closes_at,
  } = await req.json()
  if (!name) return NextResponse.json({ error: 'Season name is required' }, { status: 400 })

  const allowOnline = typeof allow_online_registration === 'boolean' ? allow_online_registration : false

  const parseTs = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v !== 'string') return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const insertRow: Record<string, unknown> = {
    name,
    type: 'season',
    start_date: start_date || null,
    end_date: end_date || null,
    organization_id: org.id,
    is_active: true,
    allow_online_registration: allowOnline,
  }

  if (allowOnline) {
    insertRow.online_registration_opens_at = parseTs(online_registration_opens_at)
    insertRow.online_registration_closes_at = parseTs(online_registration_closes_at)
  }

  let { error } = await supabaseAdmin.from('seasons').insert(insertRow)

  if (error && String(error.message || '').includes('allow_online_registration')) {
    delete insertRow.allow_online_registration
    delete insertRow.online_registration_opens_at
    delete insertRow.online_registration_closes_at
    const retry = await supabaseAdmin.from('seasons').insert(insertRow)
    error = retry.error
  }

  if (error && String(error.message || '').includes('online_registration_')) {
    delete insertRow.online_registration_opens_at
    delete insertRow.online_registration_closes_at
    const retry = await supabaseAdmin.from('seasons').insert(insertRow)
    error = retry.error
  }

  if (error) return NextResponse.json({ error: 'Failed to create season' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const {
    season_id,
    is_active,
    allow_online_registration,
    online_registration_opens_at,
    online_registration_closes_at,
  } = await req.json()
  if (!season_id) return NextResponse.json({ error: 'season_id is required' }, { status: 400 })

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id, organization_id')
    .eq('id', season_id)
    .single()

  if (!season || season.organization_id !== org.id) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 })
  }

  const parseTs = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v !== 'string') return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const update: Record<string, unknown> = {}
  if (typeof is_active === 'boolean') update.is_active = is_active
  if (typeof allow_online_registration === 'boolean') {
    update.allow_online_registration = allow_online_registration
  }
  if (online_registration_opens_at !== undefined) {
    update.online_registration_opens_at = parseTs(online_registration_opens_at)
  }
  if (online_registration_closes_at !== undefined) {
    update.online_registration_closes_at = parseTs(online_registration_closes_at)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  let { error } = await supabaseAdmin.from('seasons').update(update).eq('id', season_id)

  if (error && String(error.message || '').includes('allow_online_registration')) {
    delete update.allow_online_registration
    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Run the database migration for online season signup (allow_online_registration).' },
        { status: 500 }
      )
    }
    const retry = await supabaseAdmin.from('seasons').update(update).eq('id', season_id)
    error = retry.error
  }

  if (error && String(error.message || '').includes('online_registration_')) {
    delete update.online_registration_opens_at
    delete update.online_registration_closes_at
    const retry = await supabaseAdmin.from('seasons').update(update).eq('id', season_id)
    error = retry.error
  }

  if (error) return NextResponse.json({ error: 'Failed to update season' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

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