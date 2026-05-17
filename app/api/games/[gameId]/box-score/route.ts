import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Organizer read-only box score (full stat grid) for Dashboard → Stats. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { gameId } = await params
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  const { data: game, error: gameErr } = await supabaseAdmin
    .from('games')
    .select(
      'id,organization_id,home_team_id,away_team_id,home_score,away_score,status,period,game_clock,scheduled_at,location'
    )
    .eq('id', gameId)
    .eq('organization_id', gate.organizationId)
    .maybeSingle()

  if (gameErr || !game?.id) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const pair = [game.home_team_id, game.away_team_id].filter(Boolean) as string[]

  const { data: stats } = await supabaseAdmin
    .from('player_game_stats')
    .select(
      'id,team_id,player_id,pts,fg2m,fg3m,ftm,ast,reb,stl,blk,tov,pf,seconds_played,players(full_name,jersey_number)'
    )
    .eq('game_id', gameId)

  let teams: { id: string; name: string | null; color: string | null }[] = []
  if (pair.length) {
    const tq = await supabaseAdmin.from('teams').select('id,name,color').in('id', pair)
    teams = tq.data || []
  }
  const homeTeam = teams.find((t) => t.id === game.home_team_id) ?? null
  const awayTeam = teams.find((t) => t.id === game.away_team_id) ?? null

  const { organization_id: _org, ...gameForClient } = game as typeof game & {
    organization_id?: string | null
  }
  void _org

  return NextResponse.json(
    {
      game: gameForClient,
      homeTeam,
      awayTeam,
      stats: stats ?? [],
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
