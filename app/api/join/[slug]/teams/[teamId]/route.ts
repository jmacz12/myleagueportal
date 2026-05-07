import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EMPTY_LEAGUE_SITE, parseLeagueSitePayload } from '@/lib/league-site'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatPosition(row: {
  positions?: string[] | null
}): string | null {
  const arr = row.positions
  if (Array.isArray(arr) && arr.length > 0) return arr.join(', ')
  return null
}

/**
 * Public team page payload — roster without email/phone (Basic tier).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { slug, teamId } = await params

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, primary_color, logo_url, league_theme_preset, league_appearance_mode, plan')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, name, color, season_id, organization_id')
    .eq('id', teamId)
    .single()

  if (teamError || !team || team.organization_id !== org.id) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id, name')
    .eq('id', team.season_id)
    .maybeSingle()

  const { data: players, error: playersError } = await supabaseAdmin
    .from('players')
    .select('id, full_name, jersey_number, positions')
    .eq('team_id', teamId)
    .order('full_name', { ascending: true })

  if (playersError) {
    return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 })
  }

  const { data: openPoll } = await supabaseAdmin
    .from('jersey_polls')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'open')
    .maybeSingle()

  let publicFontKey: string | null = EMPTY_LEAGUE_SITE.publicFontKey
  const { data: siteRow, error: siteErr } = await supabaseAdmin
    .from('league_site_content')
    .select('published')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!siteErr && siteRow?.published != null) {
    publicFontKey = parseLeagueSitePayload(siteRow.published).publicFontKey
  }

  const roster = (players || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    jersey_number: p.jersey_number,
    position_label: formatPosition(p as { positions?: string[] | null }),
  }))

  return NextResponse.json({
    organization: {
      name: org.name,
      slug: org.slug,
      primary_color: org.primary_color,
      logo_url: org.logo_url,
      league_theme_preset: org.league_theme_preset ?? 'classic',
      league_appearance_mode: org.league_appearance_mode ?? 'light',
      plan: org.plan ?? 'basic',
    },
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
      season_name: season?.name || 'Season',
    },
    roster,
    open_jersey_poll_id: openPoll?.id ?? null,
    publicFontKey,
  })
}
