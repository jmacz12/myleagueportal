import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params

  const { data: stats } = await supabaseAdmin
    .from('player_game_stats')
    .select('*')
    .eq('game_id', gameId)

  return NextResponse.json({ stats: stats || [] })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { gameId } = await params
  const { player_id, stat, value } = await req.json()

  // Get player's team
  const { data: player } = await supabaseAdmin
    .from('players').select('team_id').eq('id', player_id).single()

  // Upsert stat
  const { error } = await supabaseAdmin
    .from('player_game_stats')
    .upsert({
      game_id: gameId,
      player_id,
      organization_id: org.id,
      team_id: player?.team_id || null,
      [stat]: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'game_id,player_id' })

  if (error) return NextResponse.json({ error: 'Failed to save stat' }, { status: 500 })

  // Recalculate team scores from all PTS
  const { data: allStats } = await supabaseAdmin
    .from('player_game_stats')
    .select('pts, players(team_id)')
    .eq('game_id', gameId)

  const { data: game } = await supabaseAdmin
    .from('games').select('home_team_id, away_team_id').eq('id', gameId).single()

  if (game && allStats) {
    const homeScore = allStats
      .filter((s: any) => s.players?.team_id === game.home_team_id)
      .reduce((sum: number, s: any) => sum + (s.pts || 0), 0)
    const awayScore = allStats
      .filter((s: any) => s.players?.team_id === game.away_team_id)
      .reduce((sum: number, s: any) => sum + (s.pts || 0), 0)

    await supabaseAdmin.from('games')
      .update({ home_score: homeScore, away_score: awayScore })
      .eq('id', gameId)
  }

  return NextResponse.json({ success: true })
}