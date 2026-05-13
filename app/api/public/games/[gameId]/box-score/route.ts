import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Public box score JSON for the league Stream tab (`?tab=stream&game=…`) and other clients.
 * Rows match **Dashboard → Games → scoring** (`player_game_stats` via `PATCH /api/games/[gameId]/stats`).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  const { data: game, error: gameErr } = await supabaseAdmin
    .from('games')
    .select(
      'id,home_team_id,away_team_id,home_score,away_score,status,period,game_clock,scheduled_at,location'
    )
    .eq('id', gameId)
    .maybeSingle()

  if (gameErr || !game?.id) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const pair = [game.home_team_id, game.away_team_id].filter(Boolean) as string[]

  const { data: stats } = await supabaseAdmin
    .from('player_game_stats')
    .select('id,team_id,player_id,pts,fg2m,fg3m,ftm,ast,reb,stl,blk,tov,pf,players(full_name,jersey_number)')
    .eq('game_id', gameId)

  let teams: { id: string; name: string | null; color: string | null }[] = []
  if (pair.length) {
    const tq = await supabaseAdmin.from('teams').select('id,name,color').in('id', pair)
    teams = tq.data || []
  }
  const homeTeam = teams.find((t) => t.id === game.home_team_id) ?? null
  const awayTeam = teams.find((t) => t.id === game.away_team_id) ?? null

  return NextResponse.json(
    {
      game,
      homeTeam,
      awayTeam,
      stats: stats ?? [],
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
