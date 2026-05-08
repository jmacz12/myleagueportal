import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  const { data: game } = await supabaseAdmin
    .from('games')
    .select(
      'id,organization_id,home_team_id,away_team_id,home_score,away_score,status,period,game_clock,scheduled_at,location'
    )
    .eq('id', gameId)
    .maybeSingle()

  if (!game?.id) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const [orgRes, teamRes] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id,name,plan,primary_color,logo_url')
      .eq('id', game.organization_id)
      .maybeSingle(),
    supabaseAdmin
      .from('teams')
      .select('id,name,color,logo_url')
      .in('id', [game.home_team_id, game.away_team_id].filter(Boolean) as string[]),
  ])

  const teams = teamRes.data || []
  const homeTeam = teams.find((t) => t.id === game.home_team_id) || null
  const awayTeam = teams.find((t) => t.id === game.away_team_id) || null

  return NextResponse.json(
    {
      game,
      organization: orgRes.data || null,
      homeTeam,
      awayTeam,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
