import { createClient } from '@supabase/supabase-js'
import { Trophy } from 'lucide-react'

const statKeys = ['pts', 'fg2m', 'fg3m', 'ftm', 'ast', 'reb', 'stl', 'blk', 'tov', 'pf'] as const
type StatKey = (typeof statKeys)[number]

type PlayerJoin = {
  full_name?: string | null
  jersey_number?: number | null
}

type GameStatRow = {
  id: string
  team_id: string | null
  player_id: string | null
  pts: number | null
  ast: number | null
  reb: number | null
  stl: number | null
  blk: number | null
  tov: number | null
  pf: number | null
  fg2m?: number | null
  fg3m?: number | null
  ftm?: number | null
  players: PlayerJoin | null
}

type TeamRow = { id: string; name: string | null; color: string | null }

type HighlightRow = {
  player_id: string | null
  full_name: string
  jersey_number: number | null
  team_name: string | null
  team_color: string | null
  pts: number
  ast: number
  reb: number
  stl: number
  blk: number
  tov: number
  pf: number
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function PublicScoreboard({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params

  const { data: game } = await supabaseAdmin
    .from('games').select('*').eq('id', gameId).single()

  const { data: stats } = await supabaseAdmin
    .from('player_game_stats')
    .select('*, players(full_name, jersey_number)')
    .eq('game_id', gameId)

  const { data: teams } = await supabaseAdmin
    .from('teams').select('*')

  if (!game) return (
    <div style={{ minHeight: '100vh', background: '#f2ead6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#9a8c6a' }}>Game not found</div>
    </div>
  )

  const homeTeam = teams?.find(t => t.id === game.home_team_id)
  const awayTeam = teams?.find(t => t.id === game.away_team_id)

  const homeStats: GameStatRow[] = (stats as GameStatRow[] | null | undefined)?.filter((s) => {
    const player = s.players
    return !!player && !!homeTeam && s.team_id === homeTeam.id
  }) || []

  const awayStats: GameStatRow[] = (stats as GameStatRow[] | null | undefined)?.filter((s) => {
    const player = s.players
    return !!player && !!awayTeam && s.team_id === awayTeam.id
  }) || []

  const statHeaders = ['#', 'Player', 'PTS', '2PM', '3PM', 'FTM', 'AST', 'REB', 'STL', 'BLK', 'TOV', 'PF']

  function StatTable({ teamStats, teamName, teamColor }: {
    teamStats: GameStatRow[]
    teamName: string
    teamColor: string | null
  }) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {teamColor && (
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: teamColor }} />
          )}
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a0a' }}>{teamName}</div>
        </div>
        <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '0.5px solid #d4c9a8', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px minmax(100px, 1fr) repeat(10, minmax(36px, 40px))', gap: '4px', padding: '8px 14px', background: '#ede5cc', minWidth: '520px' }}>
            {statHeaders.map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9a8c6a', textAlign: h !== 'Player' ? 'center' : 'left' }}>
                {h}
              </span>
            ))}
          </div>
          {teamStats.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#9a8c6a' }}>
              No stats yet
            </div>
          ) : teamStats.sort((a, b) => (b.pts || 0) - (a.pts || 0)).map((s, idx) => {
            const player = s.players
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '32px minmax(100px, 1fr) repeat(10, minmax(36px, 40px))', gap: '4px', padding: '10px 14px', borderTop: idx > 0 ? '0.5px solid #f0e8d0' : 'none', alignItems: 'center', minWidth: '520px' }}>
                <span style={{ fontSize: '11px', color: '#9a8c6a', textAlign: 'center' }}>{player?.jersey_number ? `#${player.jersey_number}` : '—'}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a0a' }}>{player?.full_name}</span>
                {statKeys.map((stat) => (
                  <span key={stat} style={{ fontSize: '13px', fontWeight: stat === 'pts' ? '800' : '400', color: stat === 'pts' ? '#1a1a0a' : '#6b5e3a', textAlign: 'center' }}>
                    {(Number(s[stat as StatKey] ?? 0))}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6' }}>

      {/* Header */}
      <div style={{ background: '#1a1a0a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#d4c97a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            MyLeaguePortal · Live Scoreboard
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              {homeTeam?.color && <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: homeTeam.color, display: 'inline-block', marginBottom: '4px' }} />}
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>{homeTeam?.name || 'Home'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <div style={{ background: '#d4c97a', color: '#1a1a0a', borderRadius: '8px', padding: '8px 20px', fontSize: '40px', fontWeight: '800', fontFamily: 'monospace', minWidth: '80px', textAlign: 'center' }}>
                  {game.home_score}
                </div>
                <span style={{ color: '#9a8c6a', fontSize: '20px' }}>—</span>
                <div style={{ background: '#d4c97a', color: '#1a1a0a', borderRadius: '8px', padding: '8px 20px', fontSize: '40px', fontWeight: '800', fontFamily: 'monospace', minWidth: '80px', textAlign: 'center' }}>
                  {game.away_score}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                {game.status === 'live' && (
                  <span style={{ background: '#dc2626', color: 'white', borderRadius: '99px', fontSize: '10px', fontWeight: '700', padding: '2px 8px' }}>Live</span>
                )}
                <span style={{ color: '#9a8c6a', fontSize: '12px' }}>
                  Q{game.period} · {game.game_clock}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              {awayTeam?.color && <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: awayTeam.color, display: 'inline-block', marginBottom: '4px' }} />}
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>{awayTeam?.name || 'Away'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px' }}>
        <StatTable
          teamStats={homeStats}
          teamName={homeTeam?.name || 'Home Team'}
          teamColor={homeTeam?.color || null}
        />
        <StatTable
          teamStats={awayStats}
          teamName={awayTeam?.name || 'Away Team'}
          teamColor={awayTeam?.color || null}
        />

        {/* Post-game highlights on public page */}
        {game.status === 'final' && stats && stats.length > 0 && (() => {
          const teamList = teams as TeamRow[] | null | undefined
          const statRows = stats as GameStatRow[]
          const allStats: HighlightRow[] = statRows.map((s) => {
            const player = s.players
            const team = teamList?.find((t) => t.id === s.team_id)
            return {
              player_id: s.player_id,
              full_name: player?.full_name || 'Unknown',
              jersey_number: player?.jersey_number ?? null,
              team_name: team?.name ?? null,
              team_color: team?.color ?? null,
              pts: s.pts || 0,
              ast: s.ast || 0,
              reb: s.reb || 0,
              stl: s.stl || 0,
              blk: s.blk || 0,
              tov: s.tov || 0,
              pf: s.pf || 0,
            }
          })

          function calcScore(s: HighlightRow) {
            return s.pts + (s.ast * 1.5) + (s.reb * 1.2) + (s.stl * 2) + (s.blk * 2) - (s.tov * 1.5) - (s.pf * 0.5)
          }

          const sorted = [...allStats].sort((a, b) => calcScore(b) - calcScore(a))
          const potg = sorted[0]
          const leaders = [
            { label: 'Points', value: Math.max(...allStats.map(s => s.pts)), player: allStats.sort((a,b) => b.pts-a.pts)[0] },
            { label: 'Assists', value: Math.max(...allStats.map(s => s.ast)), player: allStats.sort((a,b) => b.ast-a.ast)[0] },
            { label: 'Rebounds', value: Math.max(...allStats.map(s => s.reb)), player: allStats.sort((a,b) => b.reb-a.reb)[0] },
          ]

          return (
            <div style={{ marginTop: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8c6a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={14} strokeWidth={2} aria-hidden />
                Game highlights
              </div>

              {/* POTG */}
              <div style={{ background: '#1a1a0a', border: '1.5px solid #d4c97a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#d4c97a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  Player of the Game
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: potg.team_color || '#d4c97a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: 'white', flexShrink: 0 }}>
                    {potg.jersey_number ? `#${potg.jersey_number}` : potg.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'white', marginBottom: '2px' }}>{potg.full_name}</div>
                    <div style={{ fontSize: '11px', color: '#9a8c6a', marginBottom: '8px' }}>{potg.team_name}</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {[{l:'PTS',v:potg.pts},{l:'AST',v:potg.ast},{l:'REB',v:potg.reb}].filter(s=>s.v>0).map(s => (
                        <div key={s.l} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: '#d4c97a', lineHeight: '1' }}>{s.v}</div>
                          <div style={{ fontSize: '9px', color: '#9a8c6a', textTransform: 'uppercase', marginTop: '2px' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaders */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {leaders.map(({ label, value, player }) => (
                  <div key={label} style={{ background: 'white', border: '0.5px solid #d4c9a8', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: '#9a8c6a', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a0a', lineHeight: '1', marginBottom: '4px' }}>{value}</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#1a1a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player?.full_name?.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ fontSize: '11px', color: '#c8b98a' }}>
            Powered by <span style={{ fontWeight: '700', color: '#9a8c6a' }}>MyLeaguePortal</span>
          </span>
        </div>
      </div>
    </div>
  )
}