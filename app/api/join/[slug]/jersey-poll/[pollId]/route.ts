import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; pollId: string }> }
) {
  const { slug, pollId } = await params

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, primary_color')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const { data: poll, error: pollError } = await supabaseAdmin
    .from('jersey_polls')
    .select('id, team_id, season_id, status, organization_id')
    .eq('id', pollId)
    .single()

  if (pollError || !poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  if (poll.organization_id !== org.id) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name, color')
    .eq('id', poll.team_id)
    .single()

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('name')
    .eq('id', poll.season_id)
    .single()

  const { count: rosterCount } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', poll.team_id)

  return NextResponse.json({
    organization: {
      name: org.name,
      slug: org.slug,
      primary_color: org.primary_color,
    },
    poll: {
      id: poll.id,
      status: poll.status,
      team_name: team?.name || 'Team',
      team_color: team?.color ?? null,
      season_name: season?.name || 'Season',
      roster_count: rosterCount ?? 0,
    },
  })
}
