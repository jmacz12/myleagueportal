import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'
import { EMPTY_LEAGUE_SITE, parseLeagueSitePayload } from '@/lib/league-site'
import { isSeasonRegistrationWindowOpen } from '@/lib/seasonSignup'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Public hub payload: organization branding + signup-eligible seasons + season waiver.
 * Used by /join/[slug] and /join/[slug]/register (no auth).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const slug = normalizeJoinSlugParam((await params).slug)
  if (!slug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const org = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)

  if (!org?.id) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const seasonsQuery = await supabaseAdmin
    .from('seasons')
    .select(
      'id, name, start_date, end_date, type, is_active, allow_online_registration, online_registration_opens_at, online_registration_closes_at, signup_opens_mode, signup_opens_days_before'
    )
    .eq('organization_id', org.id)
    .eq('type', 'season')
    .order('start_date', { ascending: false })
    .limit(5)

  let seasons = seasonsQuery.data
  const seasonsErr = seasonsQuery.error

  if (
    seasonsErr &&
    (String(seasonsErr.message || '').includes('allow_online_registration') ||
      String(seasonsErr.message || '').includes('online_registration_') ||
      String(seasonsErr.message || '').includes('signup_opens'))
  ) {
    const r = await supabaseAdmin
      .from('seasons')
      .select('id, name, start_date, end_date, type, is_active, allow_online_registration')
      .eq('organization_id', org.id)
      .eq('type', 'season')
      .order('start_date', { ascending: false })
      .limit(5)
    seasons = (r.data || []).map((s) => ({
      ...s,
      allow_online_registration: false,
      online_registration_opens_at: null,
      online_registration_closes_at: null,
      signup_opens_mode: null,
      signup_opens_days_before: null,
    }))
  }

  const allCompetitive = seasons || []
  const signupSeasons = allCompetitive.filter((s) => isSeasonRegistrationWindowOpen(s))
  const openNow = signupSeasons[0]
  const activeFallback = allCompetitive.find((s) => !!s.is_active)
  const competitiveSeason = openNow ?? activeFallback ?? allCompetitive[0] ?? null

  const { data: seasonWaiver } = await supabaseAdmin
    .from('waivers')
    .select('id, title, content')
    .eq('organization_id', org.id)
    .eq('type', 'season')
    .eq('is_active', true)
    .maybeSingle()

  let leagueSite = EMPTY_LEAGUE_SITE
  const { data: siteRow, error: siteErr } = await supabaseAdmin
    .from('league_site_content')
    .select('published')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!siteErr && siteRow?.published != null) {
    leagueSite = parseLeagueSitePayload(siteRow.published)
  }

  const seasonRegistrationOpen = signupSeasons.length > 0

  return NextResponse.json({
    organization: org,
    competitiveSeason,
    /** All seasons currently eligible for signup; register page can show a picker when >1. */
    signupSeasons,
    seasonWaiver,
    /** True when online signup is on and inside optional opens/closes window */
    seasonRegistrationOpen,
    /** Published public home content (news, media, hero background, etc.) */
    leagueSite,
  })
}
