import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Public hub payload: organization branding + active competitive season + season waiver.
 * Used by /join/[slug] and /join/[slug]/register (no auth).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let { data: orgWithTz, error: orgWithTzError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, primary_color, logo_url, news_banner, news_banner_color, league_timezone')
    .eq('slug', slug)
    .single()

  const { data: orgWithoutTz } = orgWithTzError
    ? await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, primary_color, logo_url, news_banner, news_banner_color')
        .eq('slug', slug)
        .single()
    : { data: null as any }

  const org =
    orgWithTz || (orgWithoutTz ? { ...orgWithoutTz, league_timezone: null } : null)
  const orgError = orgWithTzError && !orgWithoutTz ? orgWithTzError : null

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  let { data: seasons, error: seasonsErr } = await supabaseAdmin
    .from('seasons')
    .select(
      'id, name, start_date, end_date, type, is_active, allow_online_registration, online_registration_opens_at, online_registration_closes_at'
    )
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .eq('type', 'season')
    .order('start_date', { ascending: false })
    .limit(5)

  if (
    seasonsErr &&
    (String(seasonsErr.message || '').includes('allow_online_registration') ||
      String(seasonsErr.message || '').includes('online_registration_'))
  ) {
    const r = await supabaseAdmin
      .from('seasons')
      .select('id, name, start_date, end_date, type, is_active, allow_online_registration')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .eq('type', 'season')
      .order('start_date', { ascending: false })
      .limit(5)
    seasons = (r.data || []).map((s) => ({
      ...s,
      allow_online_registration: false,
      online_registration_opens_at: null,
      online_registration_closes_at: null,
    }))
  }

  const competitiveSeason = seasons?.[0] ?? null

  function registrationWindowAllows(cs: {
    allow_online_registration?: boolean | null
    online_registration_opens_at?: string | null
    online_registration_closes_at?: string | null
  }) {
    if (!cs.allow_online_registration) return false
    const now = Date.now()
    if (cs.online_registration_opens_at) {
      const t = new Date(cs.online_registration_opens_at).getTime()
      if (now < t) return false
    }
    if (cs.online_registration_closes_at) {
      const t = new Date(cs.online_registration_closes_at).getTime()
      if (now > t) return false
    }
    return true
  }

  const { data: seasonWaiver } = await supabaseAdmin
    .from('waivers')
    .select('id, title, content')
    .eq('organization_id', org.id)
    .eq('type', 'season')
    .eq('is_active', true)
    .maybeSingle()

  const seasonRegistrationOpen = !!(competitiveSeason && registrationWindowAllows(competitiveSeason))

  return NextResponse.json({
    organization: org,
    competitiveSeason,
    seasonWaiver,
    /** True when online signup is on and inside optional opens/closes window */
    seasonRegistrationOpen,
  })
}
