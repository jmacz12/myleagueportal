'use client'

import { Handshake, Trophy } from 'lucide-react'
import { formatSecondsAsMinSec } from '@/lib/game-lineup-minutes'

interface PlayerStat {
  player_id: string
  full_name: string
  jersey_number: string | null
  team_name: string | null
  team_color: string | null
  pts: number
  ast: number
  reb: number
  stl: number
  blk: number
  tov: number
  pf: number
  seconds_played?: number
}

interface Props {
  stats: PlayerStat[]
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  onClose?: () => void
}

export default function GameHighlights({
  stats, homeTeamName, awayTeamName,
  homeScore, awayScore, onClose
}: Props) {

  // Option A performance formula
  function calcScore(s: PlayerStat) {
    return s.pts + (s.ast * 1.5) + (s.reb * 1.2) + (s.stl * 2) + (s.blk * 2) - (s.tov * 1.5) - (s.pf * 0.5)
  }

  if (stats.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
      No stats recorded for this game.
    </div>
  )

  const sorted = [...stats].sort((a, b) => calcScore(b) - calcScore(a))
  const potg = sorted[0]
  const runners = sorted.slice(1, 4)

  const leaders = [
    { label: 'Points', stat: 'pts', player: [...stats].sort((a, b) => b.pts - a.pts)[0] },
    { label: 'Assists', stat: 'ast', player: [...stats].sort((a, b) => b.ast - a.ast)[0] },
    { label: 'Rebounds', stat: 'reb', player: [...stats].sort((a, b) => b.reb - a.reb)[0] },
    { label: 'Steals', stat: 'stl', player: [...stats].sort((a, b) => b.stl - a.stl)[0] },
  ]

  const winner = homeScore > awayScore ? homeTeamName : awayScore > homeScore ? awayTeamName : null
  const totalPts = homeScore + awayScore

  return (
    <div>
      {/* Final score banner */}
      <div style={{
        background: 'var(--btn-primary-bg)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--btn-primary-text)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
            Final Score
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--btn-primary-text)' }}>
            {homeTeamName} {homeScore} — {awayScore} {awayTeamName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {winner && (
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--btn-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              <Trophy size={15} strokeWidth={2} aria-hidden />
              {winner} wins
            </div>
          )}
          {!winner && (
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--btn-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              <Handshake size={15} strokeWidth={2} aria-hidden />
              Tie game
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--btn-primary-text)', opacity: 0.7 }}>
            {totalPts} total points
          </div>
        </div>
      </div>

      {/* Player of the Game */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))',
        border: '1.5px solid var(--accent)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trophy size={14} strokeWidth={2} aria-hidden />
          Player of the Game
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: potg.team_color || 'var(--accent-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: '800', color: 'white',
            flexShrink: 0, border: '2px solid var(--accent)',
          }}>
            {potg.jersey_number ? `#${potg.jersey_number}` : potg.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {potg.full_name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {potg.team_name}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>
                  {formatSecondsAsMinSec(potg.seconds_played ?? 0)}
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                  }}
                >
                  MIN
                </div>
              </div>
              {[
                { label: 'PTS', value: potg.pts },
                { label: 'AST', value: potg.ast },
                { label: 'REB', value: potg.reb },
                { label: 'STL', value: potg.stl },
                { label: 'BLK', value: potg.blk },
              ]
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>{s.value}</div>
                    <div
                      style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent)', lineHeight: '1' }}>
                  {Math.round(calcScore(potg))}
                </div>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px' }}>Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Runners up */}
      {runners.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Top Performers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {runners.map((player, idx) => (
              <div key={player.player_id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
                borderRadius: '8px', padding: '10px 12px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', width: '16px', flexShrink: 0 }}>
                  {idx + 2}
                </div>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: player.team_color || 'var(--bg-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '800', color: 'white', flexShrink: 0,
                }}>
                  {player.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{player.full_name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{player.team_name}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>
                      {formatSecondsAsMinSec(player.seconds_played ?? 0)}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>MIN</div>
                  </div>
                  {[
                    { label: 'PTS', value: player.pts },
                    { label: 'AST', value: player.ast },
                    { label: 'REB', value: player.reb },
                  ]
                    .filter((s) => s.value > 0)
                    .map((s) => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>{s.value}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
                      </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)', lineHeight: '1' }}>
                    {Math.round(calcScore(player))}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category leaders */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Game Leaders
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {leaders.map(({ label, stat, player }) => (
            <div key={stat} style={{
              background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
              borderRadius: '8px', padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {player?.full_name?.split(' ')[0]} {player?.full_name?.split(' ').slice(-1)[0]}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{player?.team_name}</div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', flexShrink: 0 }}>
                {player?.[stat as keyof PlayerStat] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {onClose && (
        <button onClick={onClose} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: '8px' }}>
          Close
        </button>
      )}
    </div>
  )
}