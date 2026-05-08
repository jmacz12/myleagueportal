import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SHOOTING = ['fg2m', 'fg3m', 'ftm'] as const
const COUNT_STATS = [...SHOOTING, 'ast', 'reb', 'stl', 'blk', 'tov', 'pf'] as const
type CountStat = (typeof COUNT_STATS)[number]

function recomputePts(row: { fg2m: number; fg3m: number; ftm: number }) {
  return 2 * row.fg2m + 3 * row.fg3m + row.ftm
}

function isCountStat(k: string): k is CountStat {
  return (COUNT_STATS as readonly string[]).includes(k)
}

export async function GET(
  _req: Request,
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
    .from('organizations')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { gameId } = await params
  const body = await req.json()
  const { player_id, stat, value, increment } = body

  if (!player_id || typeof player_id !== 'string') {
    return NextResponse.json({ error: 'player_id required' }, { status: 400 })
  }

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('organization_id, home_team_id, away_team_id')
    .eq('id', gameId)
    .single()

  if (!game || game.organization_id !== org.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('team_id')
    .eq('id', player_id)
    .eq('organization_id', org.id)
    .single()

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const { data: existing } = await supabaseAdmin
    .from('player_game_stats')
    .select('*')
    .eq('game_id', gameId)
    .eq('player_id', player_id)
    .maybeSingle()

  const base = existing
    ? {
        fg2m: existing.fg2m ?? 0,
        fg3m: existing.fg3m ?? 0,
        ftm: existing.ftm ?? 0,
        ast: existing.ast ?? 0,
        reb: existing.reb ?? 0,
        stl: existing.stl ?? 0,
        blk: existing.blk ?? 0,
        tov: existing.tov ?? 0,
        pf: existing.pf ?? 0,
      }
    : {
        fg2m: 0,
        fg3m: 0,
        ftm: 0,
        ast: 0,
        reb: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0,
      }

  if (increment && typeof increment === 'object' && increment !== null) {
    for (const [key, rawDelta] of Object.entries(increment)) {
      if (!isCountStat(key)) continue
      const d = Number(rawDelta)
      if (!Number.isFinite(d) || d === 0) continue
      const next = Math.max(0, (base[key] as number) + d)
      ;(base as Record<string, number>)[key] = next
    }
  } else if (stat !== undefined && value !== undefined) {
    const v = Number(value)
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
    }
    if (stat === 'pts') {
      base.fg2m = Math.floor(v / 2)
      base.ftm = v % 2
      base.fg3m = 0
    } else if (isCountStat(stat)) {
      ;(base as Record<string, number>)[stat] = v
    } else {
      return NextResponse.json({ error: 'Unknown stat' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'increment or stat/value required' }, { status: 400 })
  }

  const pts = recomputePts(base)

  const upsertRow: Record<string, unknown> = {
    game_id: gameId,
    player_id,
    organization_id: org.id,
    team_id: player.team_id || null,
    pts,
    ...base,
  }

  let upsertErr = (
    await supabaseAdmin.from('player_game_stats').upsert(upsertRow, {
      onConflict: 'game_id,player_id',
    })
  ).error

  if (upsertErr && String(upsertErr.message || '').toLowerCase().includes('team_id')) {
    const { team_id: _t, ...withoutTeam } = upsertRow as Record<string, unknown> & { team_id?: unknown }
    upsertErr = (
      await supabaseAdmin.from('player_game_stats').upsert(withoutTeam, {
        onConflict: 'game_id,player_id',
      })
    ).error
  }

  if (upsertErr && /\bfg2m\b|\bfg3m\b|\bftm\b/i.test(String(upsertErr.message || ''))) {
    const minimal: Record<string, unknown> = {
      game_id: gameId,
      player_id,
      organization_id: org.id,
      pts,
      ast: base.ast,
      reb: base.reb,
      stl: base.stl,
      blk: base.blk,
      tov: base.tov,
      pf: base.pf,
    }
    upsertErr = (
      await supabaseAdmin.from('player_game_stats').upsert(minimal, {
        onConflict: 'game_id,player_id',
      })
    ).error
  }

  if (upsertErr) {
    return NextResponse.json(
      { error: upsertErr.message || 'Failed to save stat' },
      { status: 500 }
    )
  }

  const sel = await supabaseAdmin
    .from('player_game_stats')
    .select('pts, team_id, player_id')
    .eq('game_id', gameId)

  let allStats = sel.data
  if (sel.error && String(sel.error.message || '').includes('team_id')) {
    const fb = await supabaseAdmin
      .from('player_game_stats')
      .select('pts, player_id')
      .eq('game_id', gameId)
    allStats = (fb.data || []).map((s) => ({ ...s, team_id: null as string | null }))
  } else if (sel.error) {
    allStats = []
  }

  if (game && allStats?.length) {
    const missingPid = [
      ...new Set(
        allStats.filter((s) => !s.team_id && s.player_id).map((s) => s.player_id as string)
      ),
    ]
    let teamByPlayer = new Map<string, string | null>()
    if (missingPid.length > 0) {
      const { data: plRows } = await supabaseAdmin
        .from('players')
        .select('id, team_id')
        .in('id', missingPid)
      teamByPlayer = new Map((plRows || []).map((p) => [p.id, p.team_id]))
    }

    let homeScore = 0
    let awayScore = 0
    for (const s of allStats) {
      const pts = Number(s.pts) || 0
      const tid = s.team_id || (s.player_id ? teamByPlayer.get(s.player_id) : null)
      if (tid === game.home_team_id) homeScore += pts
      else if (tid === game.away_team_id) awayScore += pts
    }

    await supabaseAdmin
      .from('games')
      .update({ home_score: homeScore, away_score: awayScore })
      .eq('id', gameId)
  }

  return NextResponse.json({ success: true })
}
