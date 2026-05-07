'use client'

import Link from 'next/link'
import {
  BarChart3,
  CalendarDays,
  Crown,
  LayoutList,
  Lock,
  MapPin,
  Megaphone,
  Newspaper,
  Radio,
  Users,
} from 'lucide-react'
import type { ThemePreset } from '@/lib/leagueTheme'
import { TEAM_PAGE_PRO_HEADLINE_STATS } from '@/lib/public-team-season-view'
import type { PlayerTotalsRow, PublicTeamTab, TeamPayload } from './team-page-types'

type Props = {
  data: TeamPayload
  slug: string
  preset: ThemePreset
  publicTab: PublicTeamTab
  setPublicTabQuery: (t: PublicTeamTab) => void
  watchHref: string | null
  nextGameMapsHref: string | null
}

export function PublicTeamTabPanels({
  data,
  slug,
  preset,
  publicTab,
  setPublicTabQuery,
  watchHref,
  nextGameMapsHref,
}: Props) {
  const {
    team,
    roster,
    open_jersey_poll_id,
    player_totals,
    last_game,
    recent_games,
    next_game,
    leader_badges,
    team_news = [],
    team_calendar_upcoming = [],
  } = data

  const tier = data.public_tier ?? 'basic'
  const proLike = tier === 'pro' || tier === 'enterprise'

  function fmtPts(n: number | undefined) {
    if (n === undefined || Number.isNaN(n)) return '—'
    return String(Math.round(n))
  }

  function renderNewsBlock(posts: typeof team_news, full: boolean) {
    if (posts.length === 0) {
      return (
        <div
          style={{
            background: preset.surfaceBg,
            border: `1px solid ${preset.surfaceBorder}`,
            borderRadius: '14px',
            padding: '24px 16px',
            textAlign: 'center',
            color: preset.muted,
            fontSize: '14px',
          }}
        >
          No team posts yet.
        </div>
      )
    }
    const showPosts = full ? posts : posts.slice(0, 2)
    return (
      <div
        style={{
          background: preset.surfaceBg,
          border: `1px solid ${preset.surfaceBorder}`,
          borderRadius: '14px',
          padding: '14px 16px',
          boxShadow: '0 6px 16px -12px rgba(0,0,0,0.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 800,
            color: preset.muted,
            marginBottom: '10px',
          }}
        >
          <Megaphone size={14} aria-hidden style={{ color: preset.accent }} />
          Team news
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {showPosts.map((post, i) => (
            <div
              key={post.id}
              style={{
                borderTop: i > 0 ? `1px solid ${preset.surfaceBorder}` : 'none',
                paddingTop: i > 0 ? '12px' : 0,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: preset.heading }}>{post.title}</span>
                {post.pinned ? (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: preset.accent,
                      background: preset.accentSoftBg,
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}
                  >
                    Pinned
                  </span>
                ) : null}
                <span style={{ fontSize: '11px', color: preset.muted }}>
                  {post.created_at
                    ? new Date(post.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : ''}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: preset.body, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{post.body}</p>
            </div>
          ))}
        </div>
        {!full && posts.length > 2 ? (
          <button
            type="button"
            onClick={() => setPublicTabQuery('news')}
            style={{
              marginTop: '12px',
              border: 'none',
              background: 'transparent',
              color: preset.accent,
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            All news ({posts.length}) →
          </button>
        ) : null}
      </div>
    )
  }

  function renderCalendarBlock() {
    if (team_calendar_upcoming.length === 0) {
      return (
        <div
          style={{
            background: preset.surfaceBg,
            border: `1px solid ${preset.surfaceBorder}`,
            borderRadius: '14px',
            padding: '24px 16px',
            textAlign: 'center',
            color: preset.muted,
            fontSize: '14px',
          }}
        >
          No upcoming team events. Check the Overview tab for the next league game.
        </div>
      )
    }
    return (
      <div
        style={{
          background: preset.surfaceBg,
          border: `1px solid ${preset.surfaceBorder}`,
          borderRadius: '14px',
          padding: '14px 16px',
          boxShadow: '0 6px 16px -12px rgba(0,0,0,0.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 800,
            color: preset.muted,
            marginBottom: '10px',
          }}
        >
          <CalendarDays size={14} aria-hidden style={{ color: preset.accent }} />
          Team calendar · upcoming
        </div>
        <p style={{ fontSize: '12px', color: preset.muted, margin: '0 0 10px', lineHeight: 1.45 }}>
          Practices and team events. League fixtures appear as <strong style={{ color: preset.body }}>Next game</strong> on Overview when
          scheduled.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {team_calendar_upcoming.map((ev, i) => {
            const mapsHref = ev.location
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`
              : null
            return (
              <div
                key={ev.id}
                style={{
                  borderTop: i > 0 ? `1px solid ${preset.surfaceBorder}` : 'none',
                  paddingTop: i > 0 ? '10px' : 0,
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: preset.heading }}>{ev.title}</div>
                <div style={{ fontSize: '13px', color: preset.body, marginTop: '4px' }}>
                  {new Date(ev.starts_at).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {ev.ends_at
                    ? ` – ${new Date(ev.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                    : ''}
                </div>
                {ev.location ? (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <MapPin size={14} aria-hidden style={{ color: preset.accent }} />
                    <span style={{ fontSize: '13px', color: preset.body }}>{ev.location}</span>
                    {mapsHref ? (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', fontWeight: 700, color: preset.accent, textDecoration: 'none' }}
                      >
                        Map ↗
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {ev.notes ? (
                  <p style={{ fontSize: '12px', color: preset.muted, margin: '6px 0 0', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{ev.notes}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderRosterTable(includeStats: boolean) {
    const statCols = includeStats && proLike
    const entExtra = includeStats && tier === 'enterprise'
    return (
      <div
        style={{
          background: preset.surfaceBg,
          border: `1px solid ${preset.surfaceBorder}`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 20px -14px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${preset.surfaceBorder}`,
            fontSize: '13px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 800,
            color: preset.muted,
          }}
        >
          {includeStats ? 'Season stats' : 'Roster'}
          {includeStats && tier === 'pro' ? (
            <span
              style={{
                display: 'block',
                marginTop: '6px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'none',
                letterSpacing: '0.02em',
                color: preset.muted,
              }}
            >
              Pro: five headline totals. Enterprise adds TOV/PF and game log below.
            </span>
          ) : null}
        </div>
        {roster.length === 0 ? (
          <div style={{ padding: '24px 18px', color: preset.body, fontSize: '14px', textAlign: 'center' }}>
            No players assigned to this team yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: preset.accentSoftBg, color: preset.body, textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Player</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Pos.</th>
                  {statCols
                    ? TEAM_PAGE_PRO_HEADLINE_STATS.map((s) => (
                        <th
                          key={s.key}
                          style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {s.label}
                        </th>
                      ))
                    : null}
                  {entExtra ? (
                    <>
                      <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>TOV</th>
                      <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>PF</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => {
                  const totals = player_totals?.[p.id]
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${preset.surfaceBorder}`, color: preset.heading }}>
                      <td style={{ padding: '12px 14px', color: preset.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {p.jersey_number !== null && p.jersey_number !== undefined ? p.jersey_number : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '999px',
                              border: `1px solid ${preset.surfaceBorder}`,
                              background: preset.accentSoftBg,
                              color: preset.body,
                              fontSize: '10px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                            aria-hidden
                          >
                            {p.full_name
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: preset.muted }}>{p.position_label || '—'}</td>
                      {statCols
                        ? TEAM_PAGE_PRO_HEADLINE_STATS.map((s) => (
                            <td
                              key={s.key}
                              style={{
                                padding: '12px 10px',
                                textAlign: 'center',
                                fontVariantNumeric: 'tabular-nums',
                                color: preset.body,
                              }}
                            >
                              {fmtPts(totals?.[s.key as keyof PlayerTotalsRow] as number | undefined)}
                              {leader_badges?.[p.id]?.[s.key as keyof PlayerTotalsRow] ? (
                                <span
                                  title="Top 5 in league"
                                  style={{ marginLeft: '4px', verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  <Crown size={11} color={preset.accent} aria-hidden />
                                </span>
                              ) : null}
                            </td>
                          ))
                        : null}
                      {entExtra ? (
                        <>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtPts(totals?.tov)}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtPts(totals?.pf)}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  function renderGameLog() {
    if (!recent_games?.length) return null
    return (
      <div
        style={{
          marginTop: '16px',
          background: preset.surfaceBg,
          border: `1px solid ${preset.surfaceBorder}`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 20px -14px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${preset.surfaceBorder}`,
            fontSize: '13px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 800,
            color: preset.muted,
          }}
        >
          Game log
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: preset.accentSoftBg, color: preset.body, textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Date</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Opponent</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Result</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {recent_games.map((g, i) => (
                <tr key={`${g.scheduled_at}-${i}`} style={{ borderTop: `1px solid ${preset.surfaceBorder}`, color: preset.heading }}>
                  <td style={{ padding: '12px 14px', color: preset.muted }}>
                    {g.scheduled_at
                      ? new Date(g.scheduled_at).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{g.opponent_name}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: g.won ? '#15803d' : preset.muted }}>
                    {g.won ? 'Win' : 'Loss'}
                  </td>
                  <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums' }}>
                    {g.team_points}-{g.opp_points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const tabItems = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutList },
    { id: 'news' as const, label: 'News', icon: Newspaper },
    { id: 'schedule' as const, label: 'Schedule', icon: CalendarDays },
    { id: 'roster' as const, label: 'Roster', icon: Users },
    {
      id: 'stats' as const,
      label: tier === 'basic' ? 'Stats' : 'Stats',
      icon: tier === 'basic' ? Lock : BarChart3,
      suffix: tier === 'basic' ? ' · Pro' : '',
    },
  ]

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '18px',
          justifyContent: 'center',
        }}
      >
        {tabItems.map(({ id, label, icon: Icon, suffix }) => {
          const active = publicTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPublicTabQuery(id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: `1.5px solid ${active ? preset.accent : preset.surfaceBorder}`,
                background: active ? preset.accentSoftBg : preset.surfaceBg,
                color: active ? preset.heading : preset.body,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={14} aria-hidden />
              {label}
              {suffix ?? ''}
            </button>
          )
        })}
      </div>

      {publicTab === 'overview' ? (
        <>
          {watchHref ? (
            <a
              href={watchHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '14px',
                padding: '14px 16px',
                borderRadius: '14px',
                background: preset.accent,
                color: '#fff',
                fontSize: '15px',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 8px 24px -12px rgba(0,0,0,0.35)',
              }}
            >
              <Radio size={20} aria-hidden />
              Watch live
            </a>
          ) : null}
          {team.house_rules?.trim() ? (
            <div
              style={{
                marginBottom: '14px',
                background: preset.surfaceBg,
                border: `1px solid ${preset.surfaceBorder}`,
                borderRadius: '14px',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800, color: preset.muted }}>
                House rules & reminders
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.body, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{team.house_rules}</p>
            </div>
          ) : null}
          {open_jersey_poll_id ? (
            <Link
              href={`/join/${slug}/jersey-poll/${open_jersey_poll_id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '12px',
                textDecoration: 'none',
                background: preset.accentSoftBg,
                border: `1px solid ${preset.surfaceBorder}`,
                color: preset.heading,
              }}
            >
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 800, color: preset.accent }}>
                  Jersey selection in progress
                </div>
                <div style={{ fontSize: '13px', color: preset.body, marginTop: '2px' }}>
                  Vote for your number for {team.name}.
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: preset.accent }}>Vote now →</span>
            </Link>
          ) : null}
          {next_game ? (
            <div
              style={{
                marginBottom: '14px',
                background: preset.surfaceBg,
                border: `1px solid ${preset.surfaceBorder}`,
                borderRadius: '14px',
                padding: '14px 16px',
                boxShadow: '0 6px 16px -12px rgba(0,0,0,0.28)',
              }}
            >
              <div style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800, color: preset.muted }}>
                Next game
              </div>
              <div style={{ marginTop: '4px', fontSize: '17px', fontWeight: 800, color: preset.heading }}>
                {team.name} vs {next_game.opponent_name}
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: preset.body }}>
                {next_game.scheduled_at
                  ? new Date(next_game.scheduled_at).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'Date/time TBD'}
              </div>
              {next_game.location ? (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <MapPin size={14} aria-hidden style={{ color: preset.accent }} />
                  <span style={{ fontSize: '13px', color: preset.body }}>{next_game.location}</span>
                  {nextGameMapsHref ? (
                    <a
                      href={nextGameMapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px', fontWeight: 700, color: preset.accent, textDecoration: 'none' }}
                    >
                      Open map ↗
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {team_news.length > 0 ? <div style={{ marginBottom: '14px' }}>{renderNewsBlock(team_news, false)}</div> : null}
          {tier === 'enterprise' ? (
            <div
              style={{
                marginTop: '16px',
                background: preset.surfaceBg,
                border: `1px solid ${preset.surfaceBorder}`,
                borderRadius: '14px',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800, color: preset.muted }}>
                Team sponsors
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: preset.body, lineHeight: 1.45 }}>
                No team sponsors added yet. Enterprise teams can feature local partner logos and links here.
              </p>
            </div>
          ) : null}
          {tier === 'basic' ? (
            <p style={{ fontSize: '12px', color: preset.muted, marginTop: '16px', lineHeight: 1.5, textAlign: 'center' }}>
              <Lock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} aria-hidden />
              Upgrade to Pro for headline player stats, record, and rank — open the <strong style={{ color: preset.body }}>Stats</strong> tab for
              a preview.
            </p>
          ) : null}
        </>
      ) : null}

      {publicTab === 'news' ? renderNewsBlock(team_news, true) : null}
      {publicTab === 'schedule' ? renderCalendarBlock() : null}
      {publicTab === 'roster' ? renderRosterTable(false) : null}
      {publicTab === 'stats' && tier === 'basic' ? (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              filter: 'blur(5px)',
              opacity: 0.55,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            aria-hidden
          >
            {renderRosterTable(true)}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              background: 'rgba(255,255,255,0.72)',
              borderRadius: '16px',
              textAlign: 'center',
            }}
          >
            <Lock size={28} color={preset.accent} aria-hidden />
            <p style={{ margin: '12px 0 0', fontSize: '16px', fontWeight: 800, color: preset.heading }}>Stats are a Pro feature</p>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.5, maxWidth: '320px' }}>
              Unlock five headline season totals, team record, league rank, and last-game teasers on your public team page.
            </p>
            <Link
              href="/dashboard/settings"
              style={{
                marginTop: '16px',
                display: 'inline-block',
                padding: '10px 18px',
                borderRadius: '10px',
                background: preset.accent,
                color: '#fff',
                fontWeight: 800,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              View plans in Settings
            </Link>
          </div>
        </div>
      ) : null}
      {publicTab === 'stats' && proLike ? (
        <>
          {renderRosterTable(true)}
          {last_game ? (
            <p style={{ fontSize: '13px', color: preset.muted, marginTop: '14px', lineHeight: 1.5 }}>
              Last final:{' '}
              <strong style={{ color: preset.heading }}>
                {last_game.won ? 'W' : 'L'} {last_game.team_points}-{last_game.opp_points}
              </strong>{' '}
              vs {last_game.opponent_name}
            </p>
          ) : null}
          {tier === 'enterprise' ? (
            renderGameLog()
          ) : (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '14px',
                border: `1px dashed ${preset.surfaceBorder}`,
                background: preset.accentSoftBg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: preset.heading, fontSize: '14px' }}>
                <Lock size={16} aria-hidden />
                Full game log is Enterprise
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                Pro shows season totals and the last result above. Upgrade to Enterprise for a complete recent games table and extra stat columns.
              </p>
              <Link href="/dashboard/settings" style={{ display: 'inline-block', marginTop: '12px', fontWeight: 700, color: preset.accent, fontSize: '13px' }}>
                Compare plans →
              </Link>
            </div>
          )}
        </>
      ) : null}
    </>
  )
}
