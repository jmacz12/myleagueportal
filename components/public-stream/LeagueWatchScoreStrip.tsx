'use client'

import Link from 'next/link'
import { contrastTextForAccent } from '@/lib/leagueTheme'

export type LeagueWatchLeaguePreset = {
  surfaceBg: string
  surfaceBorder: string
  heading: string
  body: string
  muted: string
  accent: string
  accentSoftBg: string
  pageBg: string
}

export type LeagueWatchScoreStripProps = {
  slug: string
  gameId: string
  homeName: string | null
  awayName: string | null
  homeScore: number | null
  awayScore: number | null
  period: number | null
  gameClock: string | null
  location: string | null
  /** Extra top margin when sitting directly under the video embed (default 14px). */
  marginTopPx?: number
  /**
   * When set, card uses league public theme (Stream tab on `/league/[slug]`).
   * Omit for the dark full-page watch route (`/league/[slug]/stream`).
   */
  leaguePreset?: LeagueWatchLeaguePreset
}

function periodClockLine(period: number | null, gameClock: string | null): string | null {
  const parts: string[] = []
  if (typeof period === 'number' && period > 0) parts.push(`Q${period}`)
  if (gameClock && String(gameClock).trim()) parts.push(String(gameClock).trim())
  return parts.length ? parts.join(' · ') : null
}

export function LeagueWatchScoreStrip({
  slug,
  gameId,
  homeName,
  awayName,
  homeScore,
  awayScore,
  period,
  gameClock,
  location,
  marginTopPx = 14,
  leaguePreset,
}: LeagueWatchScoreStripProps) {
  const away = awayName?.trim() || 'Away'
  const home = homeName?.trim() || 'Home'
  const pc = periodClockLine(period, gameClock)
  const venue =
    location && !location.includes('MLP_DEMO') && location.length < 200 ? location.trim() : null

  const L = leaguePreset
  const bg = L ? L.surfaceBg : 'rgba(15,23,42,0.92)'
  const border = L ? L.surfaceBorder : 'rgba(148,163,184,0.28)'
  const labelMuted = L ? L.muted : '#94a3b8'
  const nameColor = L ? L.heading : '#f8fafc'
  const scoreColor = L ? L.heading : '#f8fafc'
  const atColor = L ? L.muted : '#64748b'
  const pcColor = L ? L.muted : '#94a3b8'
  const btnBg = L ? L.accent : '#38bdf8'
  const btnFg = L ? contrastTextForAccent(L.accent) : '#0f172a'
  const linkColor = L ? L.accent : '#93c5fd'
  const summaryColor = L ? L.body : '#cbd5e1'
  const detailBody = L ? L.muted : '#94a3b8'
  const detailStrong = L ? L.heading : '#e2e8f0'
  const detailsRule = L ? L.surfaceBorder : 'rgba(148,163,184,0.2)'

  return (
    <div
      style={{
        marginTop: `${marginTopPx}px`,
        padding: '14px 16px 16px',
        borderRadius: '14px',
        background: bg,
        border: `1px solid ${border}`,
        color: L ? L.body : '#e2e8f0',
        boxShadow: L ? '0 8px 24px -18px rgba(0,0,0,0.12)' : undefined,
      }}
    >
      <p
        style={{
          margin: '0 0 10px',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: labelMuted,
        }}
      >
        Live score
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px 16px',
        }}
      >
        <div style={{ flex: '1 1 120px', minWidth: 0, textAlign: 'left' }}>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 800,
              color: nameColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={away}
          >
            {away}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', color: scoreColor }}>
            {typeof awayScore === 'number' ? awayScore : '—'}
          </p>
        </div>
        <div
          style={{
            flex: '0 0 auto',
            alignSelf: 'center',
            fontSize: '15px',
            fontWeight: 900,
            color: atColor,
            padding: '0 4px',
          }}
        >
          @
        </div>
        <div style={{ flex: '1 1 120px', minWidth: 0, textAlign: 'right' }}>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 800,
              color: nameColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={home}
          >
            {home}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', color: scoreColor }}>
            {typeof homeScore === 'number' ? homeScore : '—'}
          </p>
        </div>
      </div>
      {pc ? (
        <p style={{ margin: '10px 0 0', fontSize: '13px', fontWeight: 700, color: pcColor, textAlign: 'center' }}>{pc}</p>
      ) : null}
      <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px 14px', alignItems: 'center', justifyContent: 'center' }}>
        <Link
          href={`/league/${encodeURIComponent(slug)}?tab=stream&game=${encodeURIComponent(gameId)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            padding: '0 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 800,
            textDecoration: 'none',
            background: btnBg,
            color: btnFg,
          }}
        >
          Full box score
        </Link>
        <Link href={`/league/${encodeURIComponent(slug)}?tab=schedule`} style={{ fontSize: '13px', fontWeight: 700, color: linkColor }}>
          League schedule
        </Link>
        {L ? (
          <Link
            href={`/league/${encodeURIComponent(slug)}/stream`}
            style={{ fontSize: '13px', fontWeight: 700, color: linkColor }}
          >
            Wide player view
          </Link>
        ) : null}
      </div>
      <details style={{ marginTop: '14px', borderTop: `1px solid ${detailsRule}`, paddingTop: '12px' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 800,
            color: summaryColor,
            listStyle: 'none',
          }}
        >
          Game details
        </summary>
        <div style={{ marginTop: '12px', fontSize: '13px', lineHeight: 1.55, color: detailBody }}>
          {venue ? (
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: detailStrong }}>Venue:</strong> {venue}
            </p>
          ) : null}
          <p style={{ margin: 0 }}>
            Player stats, fouls, and shooting lines are on the league Stream tab (same game) so this watch page stays easy to read next to the video.
          </p>
        </div>
      </details>
    </div>
  )
}
