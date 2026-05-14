'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  LeagueSiteHeroEditOverlay,
  LeagueSiteLookControls,
  LeagueSiteSectionQuickAdd,
  LeagueSiteSectionsEditor,
  LeagueSiteStickyEditBar,
} from '@/components/league-site/LeagueSiteOnPageEditor'
import {
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Lock,
  MapPin,
  Trophy,
  Users,
  ShieldHalf,
  BarChart3,
  Info,
} from 'lucide-react'
import NewsBanner from '@/components/NewsBanner'
import { MediaGalleryPublic } from '@/components/league-site/MediaGalleryPublic'
import { leagueSiteCreativeStageMinHeightCss } from '@/lib/league-site-creative-canvas'
import { LeagueNotFoundOrganizerHint } from '@/components/LeagueNotFoundOrganizerHint'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import type { LeagueAppearanceMode } from '@/lib/leagueTheme'
import {
  PRESET_PORTAL_ORIGINAL_ID,
  contrastTextForAccent,
  publicHeroThemeFromPreset,
  resolveThemePreset,
} from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import type {
  LeagueSiteContentSurface,
  LeagueSiteNewsTabSection,
  LeagueSitePayload,
  LeagueSiteSection,
  LeagueSiteSectionMediaPlacement,
} from '@/lib/league-site'
import {
  DEFAULT_LEAGUE_HERO_TAGLINE,
  EMPTY_LEAGUE_SITE,
  displayHeroInitials,
  isLeagueSiteAboutTabSection,
  isLeagueSiteHomeSurfaceSection,
  isLeagueSiteNewsSurfaceSection,
  resolveLeagueSiteContentBlockTextColor,
} from '@/lib/league-site'
import {
  leagueSiteCreativeBodyTypography,
  leagueSiteCreativeHeadingTypography,
} from '@/lib/league-site-creative-typography'
import { subscribeLeagueAppearanceUpdated } from '@/lib/league-appearance-sync'
import {
  googleFontStylesheetHref,
  resolvePortalOriginalHeadingFontStack,
  resolvePublicLeagueFontStack,
} from '@/lib/public-league-fonts'
import { LeaguePublicStreamFanBlock } from '@/components/public-stream/LeaguePublicStreamFanBlock'
import {
  PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA,
  PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE,
  PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE_TITLE,
  PUBLIC_STREAM_HUB_UPSELL,
} from '@/lib/public-plan-copy'
import { parseJoinStreamLivePayload, type JoinStreamLivePayload } from '@/lib/join-stream-live'
import { isProOrEnterprise } from '@/lib/org-plan-tier'
import { createClient } from '@supabase/supabase-js'
import { type LeagueFeaturedGamePayload } from '@/lib/league-public-home-schedule'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface HubOrg {
  id: string
  name: string
  slug: string
  primary_color: string | null
  logo_url: string | null
  news_banner: string | null
  news_banner_color: string | null
  league_theme_preset?: string | null
  league_appearance_mode?: string | null
  league_timezone?: string | null
  /** Stripe plan slug — drives public tier messaging */
  plan?: string | null
}

interface CompetitiveSeason {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  allow_online_registration?: boolean
  online_registration_opens_at?: string | null
  online_registration_closes_at?: string | null
}

interface HubResponse {
  organization: HubOrg
  competitiveSeason: CompetitiveSeason | null
  seasonRegistrationOpen: boolean
  leagueSite: LeagueSitePayload
}

interface PublicTeamRow {
  id: string
  name: string
  color: string | null
  logo_url?: string | null
  season_id: string | null
  season_name: string
  player_count: number
  open_jersey_poll_id: string | null
}

interface LeagueScheduleItem {
  id: string
  source_id: string
  type: 'season_game' | 'drop_in'
  name: string
  scheduled_at: string
  location_label?: string | null
  fee_amount?: number | null
  is_user_playing?: boolean
  /** Same flag as dashboard; used to group recurring series on the public schedule. */
  is_recurring?: boolean
  /** Season games only — from public sessions API. */
  game_status?: string | null
  home_score?: number | null
  away_score?: number | null
  /** Drop-in roster size (non-guest); from join sessions API. */
  roster_count?: number
  waitlist_count?: number
  max_players?: number | null
  max_waitlist?: number | null
}

interface LeagueStandingRow {
  team_id: string
  team_name: string
  wins: number
  losses: number
  pct: number
}

interface LeagueLeaderRow {
  player_name: string
  stat: string
  total: number
}

interface LeagueGameResultRow {
  game_id: string
  scheduled_at: string
  home_team_id: string | null
  away_team_id: string | null
  home_team_name: string
  away_team_name: string
  home_score: number | null
  away_score: number | null
}

type LeagueStandingsInnerTab = 'overview' | 'history'

function normalizeLeagueGameResults(raw: unknown): LeagueGameResultRow[] {
  if (!Array.isArray(raw)) return []
  const out: LeagueGameResultRow[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.game_id !== 'string' || typeof o.scheduled_at !== 'string') continue
    out.push({
      game_id: o.game_id,
      scheduled_at: o.scheduled_at,
      home_team_id: typeof o.home_team_id === 'string' ? o.home_team_id : null,
      away_team_id: typeof o.away_team_id === 'string' ? o.away_team_id : null,
      home_team_name: typeof o.home_team_name === 'string' ? o.home_team_name : 'Home',
      away_team_name: typeof o.away_team_name === 'string' ? o.away_team_name : 'Away',
      home_score: typeof o.home_score === 'number' ? o.home_score : null,
      away_score: typeof o.away_score === 'number' ? o.away_score : null,
    })
  }
  return out
}

interface LeagueStandingDisplayRow {
  row: LeagueStandingRow
  rank: number
  gp: number
  gbDisplay: string
  pctDisplay: string
}

/** Rank with ties (same W–L–PCT share a rank). GB vs first place in sort order. */
function buildLeagueStandingsDisplayRows(rows: LeagueStandingRow[]): LeagueStandingDisplayRow[] {
  if (rows.length === 0) return []
  const leader = rows[0]!
  const out: LeagueStandingDisplayRow[] = []
  let rank = 1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (i > 0) {
      const prev = rows[i - 1]!
      const tied = row.pct === prev.pct && row.wins === prev.wins && row.losses === prev.losses
      if (!tied) rank = i + 1
    }
    const gp = row.wins + row.losses
    const pctDisplay = gp === 0 ? '—' : row.pct.toFixed(3)

    let gbDisplay = '—'
    if (i > 0) {
      const leaderGp = leader.wins + leader.losses
      const rowGp = row.wins + row.losses
      if (leaderGp > 0 || rowGp > 0) {
        const raw = (leader.wins - row.wins + (row.losses - leader.losses)) / 2
        if (raw > 0) {
          gbDisplay = Number.isInteger(raw) ? String(raw) : raw.toFixed(1)
        }
      }
    }

    out.push({ row, rank, gp, gbDisplay, pctDisplay })
  }
  return out
}

function LeagueSiteSections({
  site,
  preset,
  maxWidth = '1000px',
  posterLayout = false,
  headingFontFamily,
}: {
  site: LeagueSitePayload
  preset: ReturnType<typeof resolveThemePreset>
  maxWidth?: string
  posterLayout?: boolean
  headingFontFamily?: string
}) {
  if (!site.sections.length) return null
  return (
    <div style={{ maxWidth, margin: '0 auto', padding: '0 0 32px' }}>
      {site.sections.map((sec) => (
        <LeagueSiteSectionBlock
          key={sec.id}
          section={sec}
          preset={preset}
          posterLayout={posterLayout}
          headingFontFamily={headingFontFamily}
        />
      ))}
    </div>
  )
}

function firstImageInItems(items: { kind: string; url: string }[]): { index: number; url: string } | null {
  const index = items.findIndex((i) => i.kind === 'image')
  if (index < 0) return null
  return { index, url: items[index].url }
}

function LeagueSiteSectionBlock({
  section,
  preset,
  posterLayout = false,
  headingFontFamily,
}: {
  section: LeagueSiteSection
  preset: ReturnType<typeof resolveThemePreset>
  posterLayout?: boolean
  headingFontFamily?: string
}) {
  const rail = posterLayout ? (
    <div
      style={{
        height: '3px',
        background: `linear-gradient(90deg, ${preset.accent} 0%, ${preset.accentMutedBg} 55%, transparent 100%)`,
      }}
    />
  ) : (
    <div
      style={{
        height: '4px',
        background: `linear-gradient(90deg, ${preset.accent} 0%, ${preset.accent} 35%, transparent 100%)`,
      }}
    />
  )

  const h2Style: CSSProperties = {
    fontFamily: headingFontFamily,
    fontSize: posterLayout ? 'clamp(22px, 2.8vw, 28px)' : 'clamp(20px, 2.5vw, 24px)',
    fontWeight: posterLayout ? 800 : 900,
    color: preset.heading,
    margin: '0 0 16px',
    letterSpacing: posterLayout ? '-0.01em' : '-0.02em',
  }

  const bodyText = (body: string) => (
    <div style={{ fontSize: '15px', color: preset.body, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{body}</div>
  )

  if (section.type === 'text') {
    return (
      <section
        style={{
          position: 'relative',
          marginBottom: posterLayout ? '24px' : '28px',
          padding: '0',
          borderRadius: posterLayout ? '16px' : '18px',
          background: preset.surfaceBg,
          border: posterLayout ? `1px solid ${preset.surfaceBorder}` : `1px solid ${preset.surfaceBorder}`,
          boxShadow: posterLayout
            ? '0 10px 40px -24px rgba(0,0,0,0.14)'
            : '0 12px 40px -24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {rail}
        <div style={{ padding: posterLayout ? '20px 22px 22px' : '24px 24px 26px' }}>
          <h2 style={h2Style}>{section.title}</h2>
          {bodyText(section.body)}
        </div>
      </section>
    )
  }

  if (section.type === 'media') {
    const rawLayout: LeagueSiteSectionMediaPlacement = section.mediaLayout ?? 'below'
    const layout: LeagueSiteSectionMediaPlacement =
      rawLayout === 'left' || rawLayout === 'right' ? 'below' : rawLayout
    const first = firstImageInItems(section.items)
    const restItems = first ? [...section.items.slice(0, first.index), ...section.items.slice(first.index + 1)] : section.items

    return (
      <section
        style={{
          position: 'relative',
          marginBottom: posterLayout ? '24px' : '28px',
          padding: '0',
          borderRadius: posterLayout ? '16px' : '18px',
          background: preset.surfaceBg,
          border: posterLayout ? `1px solid ${preset.surfaceBorder}` : `1px solid ${preset.surfaceBorder}`,
          boxShadow: posterLayout
            ? '0 10px 40px -24px rgba(0,0,0,0.14)'
            : '0 12px 40px -24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {rail}
        <div style={{ padding: posterLayout ? '20px 22px 22px' : '24px 24px 26px' }}>
          {layout === 'behind' && first ? (
            <>
              <div
                style={{
                  position: 'relative',
                  borderRadius: posterLayout ? '12px' : '14px',
                  overflow: 'hidden',
                  minHeight: 'min(240px, 42vw)',
                  marginBottom: restItems.length ? '18px' : 0,
                }}
              >
                <img
                  src={first.url}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    minHeight: 'min(240px, 42vw)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '20px 22px 22px',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.72) 100%)',
                  }}
                >
                  <h2 style={{ ...h2Style, margin: 0, color: '#fafafa', textShadow: '0 2px 16px rgba(0,0,0,0.65)' }}>
                    {section.title}
                  </h2>
                </div>
              </div>
              {restItems.length > 0 ? <MediaGalleryPublic items={restItems} preset={preset} /> : null}
            </>
          ) : (
            <>
              <h2 style={h2Style}>{section.title}</h2>
              <MediaGalleryPublic items={section.items} preset={preset} />
            </>
          )}
        </div>
      </section>
    )
  }

  if (section.type === 'content') {
    const img = section.image
    const sidePad = posterLayout ? '20px 22px 22px' : '24px 24px 26px'
    const creativeStageMinH = leagueSiteCreativeStageMinHeightCss(section.creativeStageMinPx, !!img)

    const textPiecesUi =
      section.textPieces.length > 0
        ? section.textPieces
        : [
            ...(section.title.trim()
              ? [
                  {
                    id: `${section.id}-fallback-h`,
                    role: 'heading' as const,
                    text: section.title,
                    xPct: 50,
                    yPct: 22,
                  },
                ]
              : []),
            ...(section.body.trim()
              ? [
                  {
                    id: `${section.id}-fallback-p`,
                    role: 'paragraph' as const,
                    text: section.body,
                    xPct: 50,
                    yPct: 46,
                  },
                ]
              : []),
          ]

    return (
      <section
        style={{
          position: 'relative',
          marginBottom: posterLayout ? '24px' : '28px',
          padding: '0',
          borderRadius: posterLayout ? '16px' : '18px',
          background: preset.surfaceBg,
          border: posterLayout ? `1px solid ${preset.surfaceBorder}` : `1px solid ${preset.surfaceBorder}`,
          boxShadow: posterLayout
            ? '0 10px 40px -24px rgba(0,0,0,0.14)'
            : '0 12px 40px -24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {rail}
        <div style={{ padding: sidePad }}>
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '14px',
              minHeight: creativeStageMinH,
            }}
          >
            {img ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${img.offsetX}%)`,
                  top: `calc(45% + ${img.offsetY}%)`,
                  width: `${img.widthPct}%`,
                  maxWidth: '130%',
                  transform: `translate(-50%, -50%) rotate(${img.rotateDeg}deg) scale(${img.scale})`,
                  transformOrigin: 'center center',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: img.maxHeightPx,
                    overflow: 'hidden',
                    borderRadius: img.borderRadiusPx,
                    margin: '0 auto',
                  }}
                >
                  <img
                    src={img.url}
                    alt=""
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: `${img.objectPositionX}% ${img.objectPositionY}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {textPiecesUi
              .filter((p) => p.text.trim())
              .map((p, idx) => {
                const xPct = 'xPct' in p && typeof p.xPct === 'number' ? p.xPct : 50
                const yPct = 'yPct' in p && typeof p.yPct === 'number' ? p.yPct : 14 + idx * 18
                const fg = resolveLeagueSiteContentBlockTextColor(section, preset, p.role)
                const headTypo = leagueSiteCreativeHeadingTypography(!!posterLayout, headingFontFamily)
                const bodyTypo = leagueSiteCreativeBodyTypography()
                const wrapStyle: CSSProperties = {
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: 'min(92%, 540px)',
                  width: 'max-content',
                  zIndex: 2,
                }
                return p.role === 'heading' ? (
                  <h2
                    key={p.id}
                    style={{
                      ...headTypo,
                      ...wrapStyle,
                      margin: 0,
                      textAlign: 'left',
                      color: fg,
                    }}
                  >
                    {p.text}
                  </h2>
                ) : (
                  <div key={p.id} style={{ ...wrapStyle, margin: 0 }}>
                    <div style={{ ...bodyTypo, color: fg }}>{p.text}</div>
                  </div>
                )
              })}
          </div>
        </div>
      </section>
    )
  }

  if (section.type === 'news') {
  const layout: LeagueSiteSectionMediaPlacement = section.mediaLayout ?? 'below'
  const first = firstImageInItems(section.items)
  const effectiveLayout: LeagueSiteSectionMediaPlacement =
    layout === 'behind' && !first ? 'below' : layout
  const restItems =
    first && effectiveLayout === 'behind'
      ? [...section.items.slice(0, first.index), ...section.items.slice(first.index + 1)]
      : section.items
  const hasBody = section.body.trim().length > 0
  const galleryBlock =
    section.items.length > 0 ? (
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <MediaGalleryPublic items={section.items} preset={preset} />
      </div>
    ) : null
  const bodyBlock = hasBody ? (
    <div style={{ flex: '1 1 240px', minWidth: 0 }}>{bodyText(section.body)}</div>
  ) : null

  return (
    <section
      style={{
        position: 'relative',
        marginBottom: posterLayout ? '24px' : '28px',
        padding: '0',
        borderRadius: posterLayout ? '16px' : '18px',
        background: preset.surfaceBg,
        border: posterLayout ? `1px solid ${preset.surfaceBorder}` : `1px solid ${preset.surfaceBorder}`,
        boxShadow: posterLayout
          ? '0 10px 40px -24px rgba(0,0,0,0.14)'
          : '0 12px 40px -24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      {rail}
      <div style={{ padding: posterLayout ? '20px 22px 22px' : '24px 24px 26px' }}>
        {effectiveLayout === 'behind' && first ? (
          <>
            <div
              style={{
                position: 'relative',
                borderRadius: posterLayout ? '12px' : '14px',
                overflow: 'hidden',
                minHeight: 'min(260px, 48vw)',
                marginBottom: restItems.length > 0 ? '18px' : 0,
              }}
            >
              <img
                src={first.url}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  minHeight: 'min(260px, 48vw)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '20px 22px',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.78) 100%)',
                }}
              >
                <h2
                  style={{
                    ...h2Style,
                    margin: 0,
                    color: '#fafafa',
                    textShadow: '0 2px 16px rgba(0,0,0,0.65)',
                  }}
                >
                  {section.title}
                </h2>
                {hasBody ? (
                  <div
                    style={{
                      fontSize: '15px',
                      color: '#f4f4f0',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      textShadow: '0 1px 10px rgba(0,0,0,0.55)',
                      maxWidth: '720px',
                    }}
                  >
                    {section.body}
                  </div>
                ) : null}
              </div>
            </div>
            {restItems.length > 0 ? <MediaGalleryPublic items={restItems} preset={preset} /> : null}
          </>
        ) : (
          <>
            <h2 style={h2Style}>{section.title}</h2>
            {effectiveLayout === 'below' ? (
              <>
                {hasBody ? bodyText(section.body) : null}
                {section.items.length > 0 ? (
                  <div style={{ marginTop: hasBody ? '18px' : 0 }}>{galleryBlock}</div>
                ) : null}
              </>
            ) : effectiveLayout === 'left' ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '20px',
                  alignItems: 'flex-start',
                }}
              >
                {galleryBlock}
                {bodyBlock}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '20px',
                  alignItems: 'flex-start',
                }}
              >
                {bodyBlock}
                {galleryBlock}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
  }

  return null
}

function formatSeasonDates(cs: CompetitiveSeason): string | null {
  if (!cs.start_date && !cs.end_date) return null
  try {
    const s = cs.start_date ? new Date(cs.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
    const e = cs.end_date ? new Date(cs.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    if (s && e) return `${s} – ${e}`
    return s || e || null
  } catch {
    return null
  }
}

type LeaguePublicTabId = 'home' | 'stream' | 'news' | 'schedule' | 'standings' | 'teams' | 'about'

const LEAGUE_TAB_META: { id: LeaguePublicTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'stream', label: 'Stream' },
  { id: 'news', label: 'News' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'standings', label: 'Standings' },
  { id: 'teams', label: 'Teams' },
  { id: 'about', label: 'About' },
]

function leagueSeasonGamePublicHref(slug: string, gameId: string) {
  return `/league/${encodeURIComponent(slug)}?tab=stream&game=${encodeURIComponent(gameId)}`
}

/** Away — home, then Q / clock when present (matches featured score line convention). */
function joinStreamLiveTeaserLine(live: JoinStreamLivePayload): string | null {
  const hs = live.homeScore
  const aw = live.awayScore
  const bits: string[] = []
  if (typeof aw === 'number' || typeof hs === 'number') {
    bits.push(`${typeof aw === 'number' ? aw : '—'} — ${typeof hs === 'number' ? hs : '—'}`)
  }
  const clockBits: string[] = []
  if (typeof live.period === 'number' && Number.isFinite(live.period)) {
    clockBits.push(`Q${live.period}`)
  }
  if (live.gameClock?.trim()) {
    clockBits.push(live.gameClock.trim())
  }
  if (clockBits.length) bits.push(clockBits.join(' · '))
  return bits.length ? bits.join(' · ') : null
}

function parseLeaguePublicTab(v: string | null): LeaguePublicTabId {
  if (v === 'stream' || v === 'news' || v === 'schedule' || v === 'standings' || v === 'teams' || v === 'about') return v
  return 'home'
}

function leagueTabToCreativeSurface(tab: LeaguePublicTabId): LeagueSiteContentSurface {
  if (tab === 'home') return 'home'
  if (tab === 'news') return 'news'
  if (tab === 'about') return 'about'
  return 'about'
}

function leaguePublicTabForCreativeSurface(surface: LeagueSiteContentSurface): LeaguePublicTabId {
  if (surface === 'home') return 'home'
  if (surface === 'news') return 'news'
  return 'about'
}

function formatDropInSessionLocal(
  scheduledAt: string,
  timeZone: string | null | undefined
): { day: string; time: string; zone: string } {
  try {
    const date = new Date(scheduledAt)
    if (Number.isNaN(date.getTime())) return { day: '', time: '', zone: '' }
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }),
      zone: date.toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone: tz }).split(' ').pop() || '',
    }
  } catch {
    return { day: '', time: '', zone: '' }
  }
}

/** Base title for recurring drop-ins (matches dashboard naming: "Series — instance"). */
function dropinSeriesBaseName(name: string): string {
  const raw = String(name || '').trim()
  if (!raw) return ''
  return raw.split(' —')[0].trim() || raw
}

function truncatePlainText(s: string, maxLen: number): string {
  const t = String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`
}

/** Public schedule line for drop-in attendance (roster + optional cap + waitlist). */
function dropinSignupSummary(item: LeagueScheduleItem): string {
  const n = typeof item.roster_count === 'number' ? item.roster_count : 0
  const cap = typeof item.max_players === 'number' && item.max_players > 0 ? item.max_players : null
  const wl = typeof item.waitlist_count === 'number' ? item.waitlist_count : 0
  const maxWl = typeof item.max_waitlist === 'number' && item.max_waitlist > 0 ? item.max_waitlist : null
  const core = cap != null ? `${n} / ${cap} signed up` : `${n} signed up`
  const rosterFull = cap != null && n >= cap
  const waitlistFull = maxWl != null && wl >= maxWl

  if (rosterFull && waitlistFull) {
    return `${core} · Full — waitlist closed`
  }
  if (rosterFull && maxWl != null && wl > 0) {
    return `${core} · Roster full · ${wl} on waitlist`
  }
  if (rosterFull && maxWl != null) {
    return `${core} · Roster full · waitlist open`
  }
  if (rosterFull) {
    return `${core} · Roster full`
  }
  return wl > 0 ? `${core} · ${wl} on waitlist` : core
}

function compareSchedulePlayingPriority(a: LeagueScheduleItem, b: LeagueScheduleItem) {
  const aPlaying = a.is_user_playing ? 1 : 0
  const bPlaying = b.is_user_playing ? 1 : 0
  if (aPlaying !== bPlaying) return bPlaying - aPlaying
  if (aPlaying === 1 && bPlaying === 1 && a.type !== b.type) {
    return a.type === 'season_game' ? -1 : 1
  }
  return 0
}

/** Upcoming / live games: signed-in playing priority, then soonest first. */
function sortLeagueScheduleItems(items: LeagueScheduleItem[]): LeagueScheduleItem[] {
  return [...items].sort((a, b) => {
    const p = compareSchedulePlayingPriority(a, b)
    if (p !== 0) return p
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  })
}

type LeagueScheduleDisplayRow =
  | { kind: 'single'; item: LeagueScheduleItem }
  | { kind: 'recurring_dropin'; base: string; items: LeagueScheduleItem[] }

/** One row per season game; recurring drop-ins with the same series title share one expandable card. */
function buildLeagueScheduleDisplayRows(sorted: LeagueScheduleItem[]): LeagueScheduleDisplayRow[] {
  const emittedRecurringBase = new Set<string>()
  const out: LeagueScheduleDisplayRow[] = []
  for (const item of sorted) {
    if (item.type === 'season_game') {
      out.push({ kind: 'single', item })
      continue
    }
    if (item.type === 'drop_in' && item.is_recurring) {
      const base = dropinSeriesBaseName(item.name)
      if (!base) {
        out.push({ kind: 'single', item })
        continue
      }
      if (emittedRecurringBase.has(base)) {
        continue
      }
      const clusterItems = sorted.filter(
        (x) => x.type === 'drop_in' && x.is_recurring && dropinSeriesBaseName(x.name) === base
      )
      clusterItems.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      emittedRecurringBase.add(base)
      if (clusterItems.length <= 1) {
        out.push({ kind: 'single', item: clusterItems[0] ?? item })
      } else {
        out.push({ kind: 'recurring_dropin', base, items: clusterItems })
      }
      continue
    }
    out.push({ kind: 'single', item })
  }
  return out
}

function seasonGameScoreSummary(item: Pick<LeagueScheduleItem, 'home_score' | 'away_score'>) {
  const hs = typeof item.home_score === 'number' ? item.home_score : null
  const aw = typeof item.away_score === 'number' ? item.away_score : null
  if (hs == null && aw == null) return null
  return `${aw ?? '—'} — ${hs ?? '—'}`
}

function LeagueHomeFeaturedGameCard({
  slug,
  preset,
  leagueTimezone,
  featured,
  lastFinal,
}: {
  slug: string
  preset: ReturnType<typeof resolveThemePreset>
  leagueTimezone: string | null | undefined
  featured: LeagueFeaturedGamePayload | null
  lastFinal: LeagueFeaturedGamePayload | null
}) {
  const showLastResult = !featured && !!lastFinal
  const display = featured ?? (showLastResult ? lastFinal : null)
  const secondaryLastFinal =
    featured && lastFinal && (featured.source_id !== lastFinal.source_id || featured.type !== lastFinal.type)
      ? lastFinal
      : null

  const badgeFor = (f: LeagueFeaturedGamePayload) => {
    if (f.type === 'season_game') return 'League game'
    if (f.is_recurring) return 'Repeating drop-in'
    return 'Drop-in'
  }

  const seasonStatusPill = (f: LeagueFeaturedGamePayload) => {
    if (f.type !== 'season_game' || !f.game_status) return null
    const st = String(f.game_status).toLowerCase()
    if (st === 'live') {
      return (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '999px',
            border: '1px solid rgba(234,88,12,0.35)',
            color: '#c2410c',
            background: 'rgba(255,237,213,0.85)',
            flexShrink: 0,
          }}
        >
          Live
        </span>
      )
    }
    if (st === 'final') {
      return (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '999px',
            border: `1px solid ${preset.surfaceBorder}`,
            color: preset.muted,
            background: preset.pageBg,
            flexShrink: 0,
          }}
        >
          Final
        </span>
      )
    }
    return null
  }

  const primaryHref =
    display?.type === 'season_game'
      ? leagueSeasonGamePublicHref(slug, display.source_id)
      : `/join/${slug}/dropins`
  const primaryLabel = display?.type === 'season_game' ? 'Box score' : 'Reserve spot'

  const eyebrow = showLastResult ? 'Latest result' : 'Featured next'
  const scoreLine =
    display && display.type === 'season_game' ? seasonGameScoreSummary(display) : null

  return (
    <section
      aria-label={showLastResult ? 'Latest game result' : 'Featured game'}
      style={{
        marginBottom: '16px',
        borderRadius: '16px',
        background: preset.surfaceBg,
        border: `1px solid ${preset.surfaceBorder}`,
        boxShadow: '0 10px 28px -20px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '3px',
          background: `linear-gradient(90deg, ${preset.accent} 0%, ${preset.accent} 40%, transparent 100%)`,
        }}
      />
      <div style={{ padding: '20px 20px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: display ? '14px' : '0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Trophy size={20} color={preset.accent} aria-hidden style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: preset.muted,
                }}
              >
                {eyebrow}
              </p>
              {!display ? (
                <p style={{ margin: '6px 0 0', fontSize: '17px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>
                  Nothing scheduled yet
                </p>
              ) : null}
            </div>
          </div>
          {display ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  color: preset.heading,
                  background: preset.accentSoftBg,
                  flexShrink: 0,
                }}
              >
                {badgeFor(display)}
              </span>
              {seasonStatusPill(display)}
            </div>
          ) : null}
        </div>

        {!display ? (
          <p style={{ margin: 0, fontSize: '14px', color: preset.muted, lineHeight: 1.55 }}>
            Add season games or open drop-ins to spotlight the next big date here—easy to share with players and fans.
          </p>
        ) : (
          <>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 'clamp(18px, 4.2vw, 22px)',
                fontWeight: 900,
                color: preset.heading,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {display.name}
            </p>
            {scoreLine ? (
              <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800, color: preset.heading, letterSpacing: '-0.02em' }}>
                {scoreLine}
              </p>
            ) : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: preset.muted, fontWeight: 600 }}>
                {(() => {
                  const loc = formatDropInSessionLocal(display.scheduled_at, leagueTimezone)
                  return (
                    <>
                      {loc.day} · {loc.time}
                      {loc.zone ? ` ${loc.zone}` : ''}
                    </>
                  )
                })()}
              </p>
              {display.is_user_playing ? (
                <span style={{ fontSize: '10px', fontWeight: 800, color: preset.accent }}>You&apos;re in</span>
              ) : null}
            </div>
            {display.location_label ? (
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: '13px',
                  color: preset.body,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                }}
              >
                <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: preset.accent }} aria-hidden />
                <span>{display.location_label}</span>
              </p>
            ) : (
              <div style={{ height: '2px' }} />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <Link
                href={primaryHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  background: preset.heading,
                  color: preset.pageBg,
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              >
                {primaryLabel}
                <ChevronRight size={16} aria-hidden />
              </Link>
              <Link
                href={`/league/${slug}?tab=schedule`}
                style={{ fontSize: '13px', fontWeight: 800, color: preset.accent, textDecoration: 'none' }}
              >
                Full schedule
              </Link>
            </div>
            {secondaryLastFinal ? (
              <div
                style={{
                  marginTop: '18px',
                  paddingTop: '16px',
                  borderTop: `1px solid ${preset.surfaceBorder}`,
                }}
              >
                <p
                  style={{
                    margin: '0 0 6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: preset.muted,
                  }}
                >
                  Latest result
                </p>
                <p
                  style={{
                    margin: '0 0 6px',
                    fontSize: '16px',
                    fontWeight: 900,
                    color: preset.heading,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25,
                  }}
                >
                  {secondaryLastFinal.name}
                </p>
                {secondaryLastFinal.type === 'season_game' ? (
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: preset.heading,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {seasonGameScoreSummary(secondaryLastFinal) ?? '—'}
                  </p>
                ) : null}
                <Link
                  href={
                    secondaryLastFinal.type === 'season_game'
                      ? leagueSeasonGamePublicHref(slug, secondaryLastFinal.source_id)
                      : `/join/${slug}/dropins`
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: preset.accent,
                    textDecoration: 'none',
                  }}
                >
                  {secondaryLastFinal.type === 'season_game' ? 'Box score' : 'Drop-ins'}
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

function LeaguePublicTabBar({
  active,
  onChange,
  tabs,
  preset,
  maxWidth = '1000px',
  headingFontFamily,
}: {
  active: LeaguePublicTabId
  onChange: (id: LeaguePublicTabId) => void
  tabs: readonly { id: LeaguePublicTabId; label: string; locked?: boolean }[]
  preset: ReturnType<typeof resolveThemePreset>
  maxWidth?: string
  headingFontFamily?: string
}) {
  const poster = preset.id === PRESET_PORTAL_ORIGINAL_ID
  return (
    <nav
      aria-label="League sections"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 45,
        background: poster ? preset.surfaceBg : preset.pageBg,
        backdropFilter: poster ? 'saturate(160%) blur(12px)' : undefined,
        WebkitBackdropFilter: poster ? 'saturate(160%) blur(12px)' : undefined,
        borderBottom: `1px solid ${preset.surfaceBorder}`,
        boxShadow: poster ? '0 2px 16px -8px rgba(0,0,0,0.08)' : '0 8px 24px -18px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          maxWidth,
          margin: '0 auto',
          padding: poster ? '12px 12px 14px' : '0 8px 2px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: poster ? '6px' : '2px',
            rowGap: poster ? '6px' : '0',
            background: poster ? preset.pageBg : undefined,
            padding: poster ? '5px' : undefined,
            borderRadius: poster ? '999px' : undefined,
            border: poster ? `1px solid ${preset.surfaceBorder}` : undefined,
          }}
        >
        {tabs.map((t) => {
          const isActive = active === t.id
          const tabLocked = !!t.locked
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tabLocked ? `${t.label} (${PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA})` : t.label}
              style={{
                flex: '0 0 auto',
                padding: poster ? '9px 18px' : '14px 14px',
                fontSize: poster ? '13px' : '13px',
                fontWeight: poster ? 600 : 800,
                letterSpacing: poster ? '0.01em' : '0.02em',
                textTransform: 'none',
                opacity: tabLocked && !isActive ? 0.88 : 1,
                ...(poster
                  ? (() => {
                      const c = isActive ? preset.accent : 'transparent'
                      return {
                        borderTopWidth: '1px',
                        borderRightWidth: '1px',
                        borderBottomWidth: '1px',
                        borderLeftWidth: '1px',
                        borderTopStyle: 'solid' as const,
                        borderRightStyle: 'solid' as const,
                        borderBottomStyle: 'solid' as const,
                        borderLeftStyle: 'solid' as const,
                        borderTopColor: c,
                        borderRightColor: c,
                        borderBottomColor: c,
                        borderLeftColor: c,
                      }
                    })()
                  : {
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderBottom: isActive ? `3px solid ${preset.accent}` : '3px solid transparent',
                    }),
                borderRadius: poster ? '999px' : undefined,
                background: poster
                  ? isActive
                    ? preset.accent
                    : 'transparent'
                  : 'transparent',
                color: poster
                  ? isActive
                    ? contrastTextForAccent(preset.accent)
                    : preset.body
                  : isActive
                    ? preset.heading
                    : preset.muted,
                cursor: 'pointer',
                fontFamily: poster && headingFontFamily ? headingFontFamily : 'inherit',
                boxShadow: poster && isActive ? '0 4px 14px -4px rgba(0,0,0,0.2)' : undefined,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                {t.label}
                {tabLocked ? (
                  <span
                    title={PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE_TITLE}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      textTransform: 'none',
                      color: poster && isActive ? 'rgba(255,255,255,0.92)' : preset.accent,
                    }}
                  >
                    <Lock size={12} strokeWidth={2.5} aria-hidden />
                    {PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
        </div>
      </div>
    </nav>
  )
}

function LeagueHomeContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const slug = params.slug as string

  const activeTab = useMemo(
    () => parseLeaguePublicTab(searchParams.get('tab')),
    [searchParams]
  )

  /** Deep-link a specific game’s box score on the Stream tab (`?tab=stream&game=<gameId>`). */
  const streamGameIdParam = useMemo(() => {
    const raw = searchParams.get('game')?.trim()
    if (!raw || raw.length > 64) return null
    if (!/^[\w-]+$/i.test(raw)) return null
    return raw
  }, [searchParams])

  const setLeagueTab = useCallback(
    (next: LeaguePublicTabId) => {
      const paramsNext = new URLSearchParams(searchParams.toString())
      if (next === 'home') paramsNext.delete('tab')
      else paramsNext.set('tab', next)
      const q = paramsNext.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const exitEditMode = useCallback(() => {
    const paramsNext = new URLSearchParams(searchParams.toString())
    paramsNext.delete('edit')
    const q = paramsNext.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  /** Preserve tab (and other query params) when opening edit mode or returning from sign-in. */
  const leaguePathWithEditQuery = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('edit', '1')
    return `/league/${slug}?${p.toString()}`
  }, [slug, searchParams])

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hub, setHub] = useState<HubResponse | null>(null)
  const [teams, setTeams] = useState<PublicTeamRow[]>([])
  const [sessions, setSessions] = useState<
    {
      id: string
      name?: string
      scheduled_at: string
      fee_amount?: number
      max_players?: number
      signups?: unknown[]
      is_recurring?: boolean
    }[]
  >([])
  const [scheduleItems, setScheduleItems] = useState<LeagueScheduleItem[]>([])
  const [featuredGame, setFeaturedGame] = useState<LeagueFeaturedGamePayload | null>(null)
  const [lastFinalGame, setLastFinalGame] = useState<LeagueFeaturedGamePayload | null>(null)
  const [expandedScheduleCluster, setExpandedScheduleCluster] = useState<Record<string, boolean>>({})
  const [standingsRows, setStandingsRows] = useState<LeagueStandingRow[]>([])
  const [gameResults, setGameResults] = useState<LeagueGameResultRow[]>([])
  const [standingsInnerTab, setStandingsInnerTab] = useState<LeagueStandingsInnerTab>('overview')
  const [leadersRows, setLeadersRows] = useState<LeagueLeaderRow[]>([])
  const [streamLive, setStreamLive] = useState<JoinStreamLivePayload | null>(null)
  const streamLiveTeaserLine = useMemo(
    () => (streamLive ? joinStreamLiveTeaserLine(streamLive) : null),
    [streamLive]
  )

  const standingsDisplayRows = useMemo(() => buildLeagueStandingsDisplayRows(standingsRows), [standingsRows])

  const [stickyVisible, setStickyVisible] = useState(false)
  const [canManageSite, setCanManageSite] = useState(false)
  const [siteAccessRole, setSiteAccessRole] = useState<'owner' | 'editor' | null>(null)
  const [accessResolved, setAccessResolved] = useState(false)
  const [signedInOrg, setSignedInOrg] = useState<{ slug: string; name: string } | null>(null)
  const [draftSite, setDraftSite] = useState<LeagueSitePayload | null>(null)
  const [draftGalleryLimit, setDraftGalleryLimit] = useState(100)
  const [draftLoadState, setDraftLoadState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editorMessage, setEditorMessage] = useState('')
  const [editorError, setEditorError] = useState('')
  const [appearancePreview, setAppearancePreview] = useState<{
    primary_color: string
    league_theme_preset: string
    league_appearance_mode: LeagueAppearanceMode
  } | null>(null)
  const [appearanceApi, setAppearanceApi] = useState<{
    proBrandColorChangesRemaining: number | null
    proBrandColorChangesMonthlyLimit: number
  } | null>(null)
  const [pendingEditorScroll, setPendingEditorScroll] = useState<{ tab: LeaguePublicTabId; id: string } | null>(null)

  const handleDraftSectionCreated = useCallback(
    (info: { id: string; surface: LeagueSiteContentSurface }) => {
      const tab = leaguePublicTabForCreativeSurface(info.surface)
      if (activeTab !== tab) setLeagueTab(tab)
      setPendingEditorScroll({ tab, id: info.id })
    },
    [activeTab, setLeagueTab]
  )

  useEffect(() => {
    if (!pendingEditorScroll) return
    if (activeTab !== pendingEditorScroll.tab) return
    const id = pendingEditorScroll.id
    const timer = window.setTimeout(() => {
      document.getElementById(`league-site-section-editor-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingEditorScroll(null)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [activeTab, pendingEditorScroll])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const hubRes = await fetch(`/api/join/${slug}/hub`)
        if (cancelled) return
        if (hubRes.status === 404) {
          setNotFound(true)
          setHub(null)
          setTeams([])
          setScheduleItems([])
          setFeaturedGame(null)
          setLastFinalGame(null)
          setStandingsRows([])
          setGameResults([])
          setLeadersRows([])
          setStreamLive(null)
          return
        }
        const hubJson = await hubRes.json().catch(() => null)
        if (!hubJson?.organization) {
          setNotFound(true)
          setHub(null)
          setTeams([])
          setScheduleItems([])
          setFeaturedGame(null)
          setLastFinalGame(null)
          setStandingsRows([])
          setGameResults([])
          setLeadersRows([])
          setStreamLive(null)
          return
        }

        const seasonQ =
          hubJson.competitiveSeason && typeof hubJson.competitiveSeason.id === 'string'
            ? `?season_id=${encodeURIComponent(hubJson.competitiveSeason.id)}`
            : ''
        const [teamsRes, sesRes, standingsRes] = await Promise.all([
          fetch(`/api/join/${slug}/teams`),
          fetch(`/api/join/${slug}/sessions`),
          fetch(`/api/join/${slug}/standings${seasonQ}`),
        ])
        if (cancelled) return

        const streamJson = await fetch(`/api/join/${slug}/stream`)
          .then((r) => r.json().catch(() => ({})))
          .catch(() => ({}))

        const teamsJson = await teamsRes.json().catch(() => ({}))
        const sesJson = await sesRes.json().catch(() => ({}))
        const standingsJson = await standingsRes.json().catch(() => ({}))

        setHub({
          organization: hubJson.organization,
          competitiveSeason: hubJson.competitiveSeason ?? null,
          seasonRegistrationOpen: !!hubJson.seasonRegistrationOpen,
          leagueSite: hubJson.leagueSite ?? EMPTY_LEAGUE_SITE,
        })
        setTeams(Array.isArray(teamsJson.teams) ? teamsJson.teams : [])
        setSessions(Array.isArray(sesJson.sessions) ? sesJson.sessions : [])
        setScheduleItems(
          Array.isArray(sesJson.scheduleItems)
            ? sesJson.scheduleItems
            : Array.isArray(sesJson.sessions)
              ? sesJson.sessions.map(
                  (s: {
                    id: string
                    name?: string
                    scheduled_at: string
                    fee_amount?: number
                    location?: string | null
                    is_recurring?: boolean
                    signups?: unknown[]
                    waitlist?: unknown[]
                    max_players?: number | null
                    max_waitlist?: number | null
                  }) => ({
                    id: `dropin:${s.id}`,
                    source_id: s.id,
                    type: 'drop_in' as const,
                    name: s.name || 'Drop-in session',
                    scheduled_at: s.scheduled_at,
                    fee_amount: typeof s.fee_amount === 'number' ? s.fee_amount : null,
                    location_label: s.location ?? null,
                    is_user_playing: false,
                    is_recurring: !!s.is_recurring,
                    roster_count: Array.isArray(s.signups) ? s.signups.length : 0,
                    waitlist_count: Array.isArray(s.waitlist) ? s.waitlist.length : 0,
                    max_players: typeof s.max_players === 'number' ? s.max_players : null,
                    max_waitlist: typeof s.max_waitlist === 'number' && s.max_waitlist > 0 ? s.max_waitlist : null,
                  }))
              : []
        )
        const fg = sesJson.featuredGame as LeagueFeaturedGamePayload | undefined
        setFeaturedGame(
          fg &&
            (fg.type === 'season_game' || fg.type === 'drop_in') &&
            typeof fg.source_id === 'string' &&
            typeof fg.scheduled_at === 'string'
            ? fg
            : null
        )
        const lf = sesJson.lastFinalGame as LeagueFeaturedGamePayload | undefined
        setLastFinalGame(
          lf &&
            lf.type === 'season_game' &&
            typeof lf.source_id === 'string' &&
            typeof lf.scheduled_at === 'string'
            ? lf
            : null
        )
        setStandingsRows(Array.isArray(standingsJson.standings) ? standingsJson.standings : [])
        setGameResults(normalizeLeagueGameResults(standingsJson.gameResults))
        setLeadersRows(Array.isArray(standingsJson.leaders) ? standingsJson.leaders : [])
        setStreamLive(parseJoinStreamLivePayload(streamJson?.live))
      } catch {
        if (!cancelled) {
          setNotFound(true)
          setHub(null)
          setTeams([])
          setScheduleItems([])
          setFeaturedGame(null)
          setLastFinalGame(null)
          setStandingsRows([])
          setGameResults([])
          setLeadersRows([])
          setStreamLive(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    setStandingsInnerTab('overview')
  }, [slug])

  const refreshStreamLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/join/${slug}/stream`)
      if (!res.ok) return
      const json = await res.json().catch(() => null)
      setStreamLive(parseJoinStreamLivePayload(json?.live))
    } catch {
      /* ignore */
    }
  }, [slug])

  /** Live tab: refetch stream context when scoring updates games/stats (no polling). */
  useEffect(() => {
    const org = hub?.organization
    if (!org?.id || !isProOrEnterprise(org.plan)) return
    let cancelled = false
    const channel = supabase
      .channel(`league-stream-org-${org.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `organization_id=eq.${org.id}` },
        () => {
          if (!cancelled) void refreshStreamLive()
        }
      )
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [hub?.organization?.id, hub?.organization?.plan, refreshStreamLive])

  /** Also listen on the active live game so stat taps (player_game_stats) refresh immediately. */
  useEffect(() => {
    if (!hub?.organization || !isProOrEnterprise(hub.organization.plan)) return
    const gid = streamLive?.gameId
    if (!gid) return
    let cancelled = false
    const channel = supabase
      .channel(`league-stream-game-${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gid}` },
        () => {
          if (!cancelled) void refreshStreamLive()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_game_stats', filter: `game_id=eq.${gid}` },
        () => {
          if (!cancelled) void refreshStreamLive()
        }
      )
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [streamLive?.gameId, refreshStreamLive, hub?.organization?.plan])

  useEffect(() => {
    if (!hub?.organization || !isProOrEnterprise(hub.organization.plan)) return
    if (activeTab !== 'stream' || !streamLive?.gameId) return
    const id = window.setInterval(() => {
      void refreshStreamLive()
    }, 2000)
    return () => window.clearInterval(id)
  }, [activeTab, streamLive?.gameId, refreshStreamLive, hub?.organization?.plan])

  useEffect(() => {
    let cancelled = false
    setAccessResolved(false)
    fetch(`/api/me/org-access?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) {
          setSignedInOrg(null)
          setCanManageSite(false)
          setSiteAccessRole(null)
          return
        }
        const d = await r.json()
        if (cancelled) return
        const a = d.access
        if (a?.slug && a?.name) {
          setSignedInOrg({ slug: String(a.slug), name: String(a.name) })
        } else {
          setSignedInOrg(null)
        }
        if (a && a.slug === slug) {
          setCanManageSite(true)
          setSiteAccessRole(a.role === 'owner' ? 'owner' : 'editor')
        } else {
          setCanManageSite(false)
          setSiteAccessRole(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedInOrg(null)
          setCanManageSite(false)
          setSiteAccessRole(null)
        }
      })
      .finally(() => {
        if (!cancelled) setAccessResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const editMode = searchParams.get('edit') === '1' && canManageSite

  const displaySite = useMemo(() => {
    if (!hub) return EMPTY_LEAGUE_SITE
    return editMode && draftSite ? draftSite : hub.leagueSite
  }, [hub, editMode, draftSite])

  const newsSections = useMemo((): LeagueSiteNewsTabSection[] => {
    return displaySite.sections.filter(isLeagueSiteNewsSurfaceSection)
  }, [displaySite.sections])
  const aboutSections = useMemo(
    () => displaySite.sections.filter(isLeagueSiteAboutTabSection),
    [displaySite.sections]
  )
  const homeSections = useMemo(
    () => displaySite.sections.filter(isLeagueSiteHomeSurfaceSection),
    [displaySite.sections]
  )

  const publicFontStack = useMemo(
    () => resolvePublicLeagueFontStack(displaySite.publicFontKey),
    [displaySite.publicFontKey]
  )

  useEffect(() => {
    const href = googleFontStylesheetHref(displaySite.publicFontKey)
    if (!href) return
    const key = displaySite.publicFontKey || 'plus-jakarta'
    const id = `public-league-font-${key}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [displaySite.publicFontKey])

  useEffect(() => {
    if (!editMode) {
      setDraftSite(null)
      setDraftLoadState('idle')
      setEditorMessage('')
      setEditorError('')
      setAppearancePreview(null)
      setAppearanceApi(null)
      return
    }
    if (!hub?.organization?.id) return

    let cancelled = false
    setDraftLoadState('loading')
    const oid = hub.organization.id
    fetch(`/api/league-site?organization_id=${encodeURIComponent(oid)}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'auth' : 'load')
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setDraftSite(data.draft ?? EMPTY_LEAGUE_SITE)
        setDraftGalleryLimit(typeof data.maxGalleryImages === 'number' ? data.maxGalleryImages : 100)
        const ap = data.appearance
        if (ap && typeof ap === 'object') {
          setAppearanceApi({
            proBrandColorChangesRemaining:
              typeof ap.proBrandColorChangesRemaining === 'number' ? ap.proBrandColorChangesRemaining : null,
            proBrandColorChangesMonthlyLimit:
              typeof ap.proBrandColorChangesMonthlyLimit === 'number' ? ap.proBrandColorChangesMonthlyLimit : 5,
          })
        }
        setDraftLoadState('ok')
      })
      .catch(() => {
        if (!cancelled) setDraftLoadState('err')
      })
    return () => {
      cancelled = true
    }
  }, [editMode, hub?.organization?.id])

  useEffect(() => {
    if (!editMode || !hub?.organization?.id) return
    const oid = hub.organization.id
    let cancelled = false
    const unsub = subscribeLeagueAppearanceUpdated(() => {
      void (async () => {
        const r = await fetch(`/api/league-site?organization_id=${encodeURIComponent(oid)}`, {
          cache: 'no-store',
          credentials: 'include',
        })
        if (!r.ok || cancelled) return
        const data = await r.json()
        const ap = data.appearance as {
          proBrandColorChangesRemaining?: unknown
          proBrandColorChangesMonthlyLimit?: unknown
        }
        if (!ap || typeof ap !== 'object' || cancelled) return
        setAppearanceApi({
          proBrandColorChangesRemaining:
            typeof ap.proBrandColorChangesRemaining === 'number' ? ap.proBrandColorChangesRemaining : null,
          proBrandColorChangesMonthlyLimit:
            typeof ap.proBrandColorChangesMonthlyLimit === 'number' ? ap.proBrandColorChangesMonthlyLimit : 5,
        })
      })()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [editMode, hub?.organization?.id])

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 96)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shellPreset = useMemo(() => resolveThemePreset('#5a7a2a', 'portal_original', 'light'), [])

  const preset = useMemo(() => {
    if (!hub) return shellPreset
    const plan = String(hub.organization.plan || 'basic').toLowerCase()
    const proLike = plan === 'pro' || plan === 'enterprise'
    const base = getPublicThemeInputsForOrg(hub.organization)
    if (
      editMode &&
      proLike &&
      siteAccessRole === 'owner' &&
      appearancePreview
    ) {
      return resolveThemePreset(
        appearancePreview.primary_color,
        appearancePreview.league_theme_preset,
        appearancePreview.league_appearance_mode
      )
    }
    return resolveThemePreset(base.primaryColor, base.presetId, base.appearanceMode)
  }, [hub, shellPreset, editMode, siteAccessRole, appearancePreview])

  const publicStreamBoxLeaguePreset = useMemo(
    () => ({
      surfaceBg: preset.surfaceBg,
      surfaceBorder: preset.surfaceBorder,
      heading: preset.heading,
      body: preset.body,
      muted: preset.muted,
      accent: preset.accent,
      accentSoftBg: preset.accentSoftBg,
      pageBg: preset.pageBg,
    }),
    [preset]
  )

  const heroTheme = useMemo(() => publicHeroThemeFromPreset(preset), [preset])

  const portalOriginalLayout = preset.id === PRESET_PORTAL_ORIGINAL_ID
  const leagueContentMax = portalOriginalLayout ? 'min(1180px, 100%)' : '1000px'
  const publicHeadingFontStack = useMemo(
    () =>
      portalOriginalLayout
        ? resolvePortalOriginalHeadingFontStack(displaySite.publicFontKey)
        : publicFontStack,
    [portalOriginalLayout, displaySite.publicFontKey, publicFontStack]
  )

  const rankedScheduleItems = useMemo(() => sortLeagueScheduleItems(scheduleItems), [scheduleItems])
  const leagueScheduleDisplayRows = useMemo(
    () => buildLeagueScheduleDisplayRows(rankedScheduleItems),
    [rankedScheduleItems]
  )
  const latestNewsSection = newsSections[0] ?? null
  const latestNewsContentThumbnail =
    latestNewsSection && latestNewsSection.type === 'content' ? (latestNewsSection.image?.url ?? null) : null
  const personalizedSchedule = useMemo(() => {
    const playing = rankedScheduleItems.filter((item) => !!item.is_user_playing)
    const out: LeagueScheduleItem[] = []
    const seenRecurringBase = new Set<string>()
    for (const item of playing) {
      if (item.type === 'drop_in' && item.is_recurring) {
        const b = dropinSeriesBaseName(item.name)
        if (seenRecurringBase.has(b)) continue
        seenRecurringBase.add(b)
      }
      out.push(item)
      if (out.length >= 3) break
    }
    return out
  }, [rankedScheduleItems])

  /** Home card: count recurring series once (matches schedule tab grouping). */
  const publicDropinSeriesCount = useMemo(() => {
    const seenRecurringBase = new Set<string>()
    let count = 0
    for (const s of sessions) {
      if (s.is_recurring) {
        const b = dropinSeriesBaseName(s.name || '')
        if (!b) {
          count++
          continue
        }
        if (seenRecurringBase.has(b)) continue
        seenRecurringBase.add(b)
        count++
      } else {
        count++
      }
    }
    return count
  }, [sessions])

  const leagueTabsForBar = useMemo(() => {
    const plan = hub ? String(hub.organization.plan || 'basic').toLowerCase() : 'basic'
    const proLike = plan === 'pro' || plan === 'enterprise'
    return LEAGUE_TAB_META.map((t) => ({ ...t, locked: t.id === 'stream' && !proLike }))
  }, [hub])

  const accent = preset.accent

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm font-semibold"
        style={{ background: preset.pageBg, color: preset.heading, fontFamily: publicFontStack }}
      >
        Loading…
      </div>
    )
  }

  if (notFound || !hub) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: preset.pageBg, fontFamily: publicFontStack }}
      >
        <p style={{ color: preset.heading, fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          League not found
        </p>
        <p style={{ color: preset.muted, fontSize: '14px', maxWidth: '360px' }}>
          {accessResolved && !signedInOrg
            ? 'Check the link or ask your organizer for the correct URL. If you run a league, sign in and use the address shown in Dashboard → Settings.'
            : 'Check the link or ask your organizer for the correct URL.'}
        </p>
        <LeagueNotFoundOrganizerHint signedInOrg={signedInOrg} currentSlug={slug} preset={preset} variant="default" />
      </div>
    )
  }

  const { organization: org, competitiveSeason, seasonRegistrationOpen } = hub
  const seasonDates = competitiveSeason ? formatSeasonDates(competitiveSeason) : null
  const registrationStatusLabel = seasonRegistrationOpen ? 'Registration Open' : 'Registration Closed'
  const totalPlayers = teams.reduce((sum, t) => sum + t.player_count, 0)
  const planSlug = String(org.plan || 'basic').toLowerCase()
  const isProLike = planSlug === 'pro' || planSlug === 'enterprise'
  const publicBrandInputs = getPublicThemeInputsForOrg(org)
  const websiteLockedForPlan = planSlug === 'basic'

  async function saveDraftOnPage() {
    if (!draftSite) return
    setSaving(true)
    setEditorMessage('')
    setEditorError('')
    try {
      const res = await fetch('/api/league-site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ draft: draftSite, organization_id: org.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditorError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      setDraftSite(data.draft ?? draftSite)
      setEditorMessage('Draft saved.')
      setEditorError('')
      exitEditMode()
    } finally {
      setSaving(false)
    }
  }

  async function publishOnPage() {
    if (!draftSite) return
    setPublishing(true)
    setEditorMessage('')
    setEditorError('')
    try {
      const res = await fetch('/api/league-site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ draft: draftSite, publish: true, organization_id: org.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditorError(typeof data.error === 'string' ? data.error : 'Publish failed')
        return
      }
      setDraftSite(data.draft ?? draftSite)
      setHub((h) => (h && data.published ? { ...h, leagueSite: data.published } : h))
      setEditorMessage('Published — visitors now see this version.')
      setEditorError('')
      exitEditMode()
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: publicFontStack }}>
      <NewsBanner message={org.news_banner} color={org.news_banner_color} />

      {searchParams.get('edit') === '1' && accessResolved && !canManageSite ? (
        <div
          style={{
            background: preset.accentSoftBg,
            borderBottom: `1px solid ${preset.surfaceBorder}`,
            padding: '12px 20px',
            textAlign: 'center',
            fontSize: '13px',
            color: preset.heading,
          }}
        >
          Sign in as a league organizer or website editor to edit this page.{' '}
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(leaguePathWithEditQuery)}`}
            style={{ fontWeight: 800, color: preset.accent }}
          >
            Sign in
          </Link>
        </div>
      ) : null}

      {editMode && draftLoadState === 'loading' ? (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            padding: '12px 20px',
            background: preset.surfaceBg,
            borderBottom: `1px solid ${preset.surfaceBorder}`,
            fontSize: '13px',
            fontWeight: 700,
            color: preset.heading,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <Loader2 size={18} className="animate-spin" aria-hidden style={{ color: preset.accent }} />
          Loading editor…
        </div>
      ) : null}

      {editMode && draftLoadState === 'err' ? (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            padding: '12px 20px',
            background: preset.surfaceBg,
            borderBottom: `1px solid ${preset.surfaceBorder}`,
            fontSize: '13px',
            color: preset.heading,
          }}
        >
          Could not load your draft.{' '}
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(leaguePathWithEditQuery)}`} style={{ fontWeight: 800, color: preset.accent }}>
            Sign in
          </Link>{' '}
          or open{' '}
          <Link href="/dashboard/league-site" style={{ fontWeight: 700, color: preset.accent }}>
            Dashboard → League website
          </Link>
          .
        </div>
      ) : null}

      {editMode && draftLoadState === 'ok' && draftSite && siteAccessRole ? (
        <>
          <LeagueSiteStickyEditBar
            preset={preset}
            saving={saving}
            publishing={publishing}
            onSaveDraft={saveDraftOnPage}
            onPublish={publishOnPage}
            statusMessage={editorMessage}
            errorMessage={editorError}
            websiteLockedForPlan={websiteLockedForPlan}
          />
          {siteAccessRole === 'owner' ? (
          <LeagueSiteLookControls
            organizationId={org.id}
            draftSite={draftSite}
            onDraftChange={(fn) => setDraftSite((d) => (d ? fn(d) : null))}
            preset={preset}
            accessRole={siteAccessRole}
            orgPlan={planSlug}
            orgPrimaryColor={org.primary_color}
            orgThemePreset={org.league_theme_preset ?? null}
            onAppearanceApplied={(o) => {
              setHub((h) =>
                h
                  ? {
                      ...h,
                      organization: {
                        ...h.organization,
                        primary_color: o.primary_color,
                        league_theme_preset: o.league_theme_preset,
                        league_appearance_mode: o.league_appearance_mode,
                      },
                    }
                  : h
              )
              if (isProLike && siteAccessRole === 'owner') {
                setAppearancePreview({
                  primary_color: (o.primary_color ?? '#5a7a2a').trim(),
                  league_theme_preset: o.league_theme_preset,
                  league_appearance_mode: o.league_appearance_mode,
                })
              }
            }}
            onAppearanceMetaApplied={(m) => {
              setAppearanceApi({
                proBrandColorChangesRemaining: m.proBrandColorChangesRemaining,
                proBrandColorChangesMonthlyLimit: m.proBrandColorChangesMonthlyLimit,
              })
            }}
            orgAppearanceMode={org.league_appearance_mode}
            onPreviewChange={isProLike && siteAccessRole === 'owner' ? setAppearancePreview : undefined}
            websiteLockedForPlan={websiteLockedForPlan}
            appearanceMeta={appearanceApi ?? undefined}
          />
          ) : null}
        </>
      ) : null}

      {!editMode ? (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 18px',
          borderBottom: `1px solid ${heroTheme.stickyBorder}`,
          background: heroTheme.stickyBackground,
          backdropFilter: 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: 'saturate(180%) blur(16px)',
          boxShadow: stickyVisible ? '0 12px 32px -20px rgba(0,0,0,0.28)' : 'none',
          transform: stickyVisible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: stickyVisible ? 1 : 0,
          pointerEvents: stickyVisible ? 'auto' : 'none',
          transition: 'transform 0.22s ease, opacity 0.18s ease, box-shadow 0.2s ease',
        }}
        aria-hidden={!stickyVisible}
      >
        <div
          style={{
            width: '100%',
            maxWidth: leagueContentMax,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          {publicBrandInputs.usePlatformBranding ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: preset.heading,
                padding: '7px 11px',
                borderRadius: '10px',
                border: `1px solid ${preset.surfaceBorder}`,
                background: preset.surfaceBg,
                flexShrink: 0,
              }}
            >
              MLP
            </span>
          ) : org.logo_url ? (
            <img src={org.logo_url} alt="" style={{ height: '38px', width: '38px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} />
          ) : (
            <div
              style={{
                height: '38px',
                width: '38px',
                borderRadius: '12px',
                background: preset.accentSoftBg,
                border: `1px solid ${preset.surfaceBorder}`,
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '-0.02em', color: preset.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {org.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {competitiveSeason && seasonRegistrationOpen ? (
              <Link
                href={`/join/${slug}/register`}
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: preset.accent,
                  color: contrastTextForAccent(preset.accent),
                }}
              >
                Join
              </Link>
            ) : null}
            <Link
              href={`/join/${slug}/dropins`}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                padding: '8px 12px',
                borderRadius: '999px',
                border: `1px solid ${preset.surfaceBorder}`,
                color: preset.heading,
                background: preset.surfaceBg,
              }}
            >
              Drop-ins
            </Link>
          </div>
        </div>
      </div>
      ) : null}

      <div style={{ position: 'relative' }}>
        <PublicLeagueHeroBand
          orgName={org.name}
          logoUrl={publicBrandInputs.usePlatformBranding ? null : org.logo_url}
          heroBackgroundUrl={publicBrandInputs.suppressCustomHero ? null : displaySite.heroBackgroundUrl}
          tagline={displaySite.heroTagline ?? DEFAULT_LEAGUE_HERO_TAGLINE}
          placeholderInitials={displayHeroInitials(displaySite.heroInitials, org.name)}
          preset={preset}
          heroTheme={heroTheme}
          usePlatformBranding={publicBrandInputs.usePlatformBranding}
          showStats
          teamsCount={teams.length}
          playersCount={totalPlayers}
          showSeasonPill={!!competitiveSeason}
        />
        {editMode && draftSite && !websiteLockedForPlan ? (
          <LeagueSiteHeroEditOverlay
            preset={preset}
            heroBackgroundUrl={draftSite.heroBackgroundUrl}
            heroTagline={draftSite.heroTagline}
            heroInitials={draftSite.heroInitials}
            organizationId={org.id}
            onChangeUrl={(url) => setDraftSite((d) => (d ? { ...d, heroBackgroundUrl: url } : null))}
            onChangeTagline={(v) => setDraftSite((d) => (d ? { ...d, heroTagline: v } : null))}
            onChangeInitials={(v) => setDraftSite((d) => (d ? { ...d, heroInitials: v } : null))}
          />
        ) : null}
      </div>

      <LeaguePublicTabBar
        active={activeTab}
        onChange={setLeagueTab}
        tabs={leagueTabsForBar}
        preset={preset}
        maxWidth={leagueContentMax}
        headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
      />

      {editMode && draftLoadState === 'ok' && draftSite && !websiteLockedForPlan ? (
        <div
          style={{
            background: preset.surfaceBg,
            borderBottom: `1px solid ${preset.surfaceBorder}`,
            padding: '14px 16px',
            boxShadow: '0 4px 24px -12px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              maxWidth: leagueContentMax,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <p style={{ margin: 0, fontSize: '13px', color: preset.body, lineHeight: 1.5 }}>
              {activeTab === 'about' ? (
                <>
                  Use <strong style={{ color: preset.heading }}>New block</strong> to add a creative block on <strong style={{ color: preset.heading }}>About</strong> (title, text, optional photo with layout controls). Switch tabs to place blocks on{' '}
                  <strong style={{ color: preset.heading }}>Home</strong> or <strong style={{ color: preset.heading }}>News</strong>. Reorder in each tab&apos;s editor.
                </>
              ) : activeTab === 'news' ? (
                <>
                  Edit <strong style={{ color: preset.heading }}>News</strong> posts here — classic news blocks or new creative blocks with text and a photo. The top item can surface on{' '}
                  <strong style={{ color: preset.heading }}>Home</strong>. Quick Add targets the tab you are on.
                </>
              ) : activeTab === 'home' ? (
                <>
                  <strong style={{ color: preset.heading }}>New block</strong> adds to <strong style={{ color: preset.heading }}>Home</strong> while you are on this tab. Open <strong style={{ color: preset.heading }}>News</strong> or{' '}
                  <strong style={{ color: preset.heading }}>About</strong> to add blocks there instead. The editor scrolls to your new block.
                </>
              ) : (
                <>
                  <strong style={{ color: preset.heading }}>New block</strong> uses the tab you are on (<strong style={{ color: preset.heading }}>About</strong> for Stream, Schedule, Teams, and Standings). Switch to Home or News to place blocks on those tabs.
                </>
              )}
            </p>
            <LeagueSiteSectionQuickAdd
              value={draftSite}
              onChange={setDraftSite}
              preset={preset}
              activeSurface={leagueTabToCreativeSurface(activeTab)}
              onSectionAdded={handleDraftSectionCreated}
            />
          </div>
        </div>
      ) : null}

      <div style={{ maxWidth: leagueContentMax, margin: '0 auto', padding: '0 24px 32px' }}>
        {activeTab === 'home' ? (
          <>
            <div
              style={{
                background: heroTheme.bandAltBg,
                borderTop: `1px solid ${preset.surfaceBorder}`,
                borderBottom: `1px solid ${preset.surfaceBorder}`,
                paddingTop: portalOriginalLayout ? '40px' : '34px',
                paddingBottom: portalOriginalLayout ? '40px' : '34px',
                paddingLeft: '24px',
                paddingRight: '24px',
                margin: '0 -24px 28px',
              }}
            >
              <div style={{ maxWidth: leagueContentMax, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                  <LayoutGrid size={20} color={preset.accent} aria-hidden />
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: preset.muted }}>
                      Get on the floor
                    </p>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: portalOriginalLayout ? 'clamp(20px, 2.8vw, 26px)' : '18px',
                        fontWeight: 900,
                        color: preset.heading,
                        letterSpacing: portalOriginalLayout ? '-0.01em' : '-0.02em',
                        fontFamily: portalOriginalLayout ? publicHeadingFontStack : undefined,
                      }}
                    >
                      Join this league
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: portalOriginalLayout
                      ? 'repeat(auto-fit, minmax(300px, 1fr))'
                      : 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: portalOriginalLayout ? '22px' : '18px',
                  }}
                >
                  {competitiveSeason && seasonRegistrationOpen ? (
                    <Link
                      href={`/join/${slug}/register`}
                      style={{
                        textDecoration: 'none',
                        background: preset.surfaceBg,
                        border: `1px solid ${preset.surfaceBorder}`,
                        borderRadius: '18px',
                        padding: '24px',
                        boxShadow: portalOriginalLayout
                          ? '0 12px 36px -20px rgba(0,0,0,0.12)'
                          : '0 14px 36px -22px rgba(0,0,0,0.35)',
                        color: 'inherit',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: portalOriginalLayout ? '12px' : '10px',
                            background: preset.accentSoftBg,
                            color: preset.accent,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trophy size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: preset.heading }}>Join the Season</div>
                          <div style={{ fontSize: '12px', color: preset.accent, fontWeight: 700 }}>{registrationStatusLabel}</div>
                        </div>
                      </div>
                      <p style={{ margin: '0 0 20px', color: preset.body, fontSize: '14px', lineHeight: 1.5 }}>
                        Register your spot for the active season and get league-ready.
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: preset.accent, fontWeight: 700, fontSize: '14px' }}>
                        <span>Register now</span>
                        <ChevronRight size={18} />
                      </div>
                    </Link>
                  ) : null}

                  <Link
                    href={`/join/${slug}/dropins`}
                    style={{
                      textDecoration: 'none',
                      background: preset.surfaceBg,
                      border: `1px solid ${preset.surfaceBorder}`,
                      borderRadius: '18px',
                      padding: '24px',
                      boxShadow: portalOriginalLayout
                        ? '0 12px 36px -20px rgba(0,0,0,0.12)'
                        : '0 14px 36px -22px rgba(0,0,0,0.35)',
                      color: 'inherit',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: portalOriginalLayout ? '12px' : '10px',
                          background: preset.accentSoftBg,
                          color: preset.heading,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CalendarDays size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: preset.heading }}>Drop-in Sessions</div>
                        <div style={{ fontSize: '12px', color: preset.muted, fontWeight: 700 }}>
                          {publicDropinSeriesCount} upcoming session{publicDropinSeriesCount === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 20px', color: preset.body, fontSize: '14px', lineHeight: 1.5 }}>
                      Browse upcoming pickup sessions and reserve your spot quickly.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: preset.heading, fontWeight: 700, fontSize: '14px' }}>
                      <span>View schedule</span>
                      <ChevronRight size={18} />
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '26px' }}>
              {streamLive ? (
                <Link
                  href={leagueSeasonGamePublicHref(slug, streamLive.gameId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    background: 'linear-gradient(90deg, rgba(220,38,38,0.12) 0%, rgba(220,38,38,0.04) 100%)',
                    border: `1px solid rgba(220,38,38,0.35)`,
                    color: preset.heading,
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: '1 1 200px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 900,
                          letterSpacing: '0.12em',
                          color: '#fff',
                          background: '#dc2626',
                          padding: '4px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        LIVE
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 800 }}>
                        {streamLive.homeName || 'Home'} vs {streamLive.awayName || 'Away'}
                      </span>
                    </span>
                    {streamLiveTeaserLine ? (
                      <span style={{ fontSize: '13px', fontWeight: 800, color: preset.body, letterSpacing: '-0.01em' }}>
                        {streamLiveTeaserLine}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: preset.accent, flexShrink: 0 }}>Watch →</span>
                </Link>
              ) : null}

              <LeagueHomeFeaturedGameCard
                slug={slug}
                preset={preset}
                leagueTimezone={org.league_timezone}
                featured={featuredGame}
                lastFinal={lastFinalGame}
              />

              {latestNewsSection ? (
                <div
                  style={{
                    background: preset.surfaceBg,
                    border: `1px solid ${preset.surfaceBorder}`,
                    borderRadius: '16px',
                    padding: '20px 20px 22px',
                    boxShadow: '0 10px 28px -20px rgba(0,0,0,0.2)',
                  }}
                >
                  <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: preset.muted }}>
                    Latest update
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>{latestNewsSection.title}</p>
                  {latestNewsSection.body.trim() ? (
                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: preset.body, lineHeight: 1.55 }}>
                      {truncatePlainText(latestNewsSection.body, 220)}
                    </p>
                  ) : null}
                  {latestNewsSection.type === 'news' ? (
                    latestNewsSection.items.filter((it) => it.kind === 'image').length > 0 ? (
                      <div style={{ margin: '0 0 14px' }}>
                        <MediaGalleryPublic
                          items={latestNewsSection.items.filter((it) => it.kind === 'image').slice(0, 6)}
                          preset={preset}
                        />
                      </div>
                    ) : null
                  ) : latestNewsContentThumbnail ? (
                    <div style={{ margin: '0 0 14px', borderRadius: '12px', overflow: 'hidden', maxHeight: '160px' }}>
                      <img
                        src={latestNewsContentThumbnail}
                        alt=""
                        style={{ width: '100%', height: '100%', maxHeight: '160px', objectFit: 'cover' }}
                      />
                    </div>
                  ) : null}
                  <Link
                    href={`/league/${slug}?tab=news`}
                    style={{ fontSize: '13px', fontWeight: 800, color: preset.accent, textDecoration: 'none' }}
                  >
                    All league news →
                  </Link>
                </div>
              ) : null}
            </div>

            {competitiveSeason ? (
              <div
                style={{
                  background: preset.surfaceBg,
                  border: `1px solid ${preset.surfaceBorder}`,
                  borderRadius: '16px',
                  padding: '22px 22px 24px',
                  marginBottom: '8px',
                  boxShadow: '0 10px 28px -20px rgba(0,0,0,0.2)',
                }}
              >
                <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: preset.muted }}>
                  League status
                </p>
                <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>{competitiveSeason.name}</p>
                {seasonDates ? <p style={{ margin: '0 0 14px', fontSize: '13px', color: preset.muted }}>{seasonDates}</p> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', fontWeight: 700, color: preset.body }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldHalf size={16} aria-hidden /> {teams.length} team{teams.length === 1 ? '' : 's'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} aria-hidden /> {totalPlayers} player{totalPlayers === 1 ? '' : 's'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Trophy size={16} aria-hidden /> {registrationStatusLabel}
                  </span>
                </div>
                <p style={{ margin: '16px 0 0', fontSize: '13px', color: preset.muted, lineHeight: 1.55 }}>
                  Latest updates live on <strong style={{ color: preset.heading }}>News</strong>; league background and media live on{' '}
                  <strong style={{ color: preset.heading }}>About</strong>.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: preset.body, lineHeight: 1.6, margin: 0 }}>
                No active season is published yet. When your organizer opens registration, you&apos;ll see season status and signup options here.
              </p>
            )}

            {editMode && draftSite && !websiteLockedForPlan ? (
              <LeagueSiteSectionsEditor
                value={draftSite}
                onChange={setDraftSite}
                preset={preset}
                maxGalleryImages={draftGalleryLimit}
                organizationId={org.id}
                showAddToolbar={false}
                maxWidth={leagueContentMax}
                subsetMode="home"
                onSectionAdded={handleDraftSectionCreated}
                onNavigateToCreativeSurface={(surf) => setLeagueTab(leaguePublicTabForCreativeSurface(surf))}
                posterLayout={portalOriginalLayout}
                headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
              />
            ) : homeSections.length > 0 ? (
              <LeagueSiteSections
                site={{ ...displaySite, sections: homeSections }}
                preset={preset}
                maxWidth={leagueContentMax}
                posterLayout={portalOriginalLayout}
                headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
              />
            ) : null}
          </>
        ) : null}

        {activeTab === 'stream' ? (
          <div
            style={{
              paddingTop: '24px',
              width: '100%',
              maxWidth: 'min(960px, 100%)',
              margin: '0 auto',
            }}
          >
            <h2
              style={{
                fontSize: 'clamp(20px, 2.5vw, 24px)',
                fontWeight: 900,
                color: preset.heading,
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
              }}
            >
              Live stream
            </h2>
            {isProLike ? (
              <>
                <p style={{ margin: '0 0 22px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, width: '100%' }}>
                  Live score and clock stay on the <strong style={{ color: preset.heading }}>video overlay</strong> while the game is in progress.{' '}
                  <strong style={{ color: preset.heading }}>Player stats</strong> below use the same rows as{' '}
                  <strong style={{ color: preset.heading }}>Dashboard → Games → scoring</strong> (threes, twos, assists, etc.) and refresh in real time. Schedule and standings links can open a specific game with{' '}
                  <strong style={{ color: preset.heading }}>?game=</strong> in the URL.
                </p>
                <LeaguePublicStreamFanBlock
                  slug={slug}
                  streamGameIdParam={streamGameIdParam}
                  streamLive={streamLive}
                  leaguePreset={publicStreamBoxLeaguePreset}
                />
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 18px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, width: '100%' }}>
                  {PUBLIC_STREAM_HUB_UPSELL.intro}
                </p>
                <div
                  style={{
                    borderRadius: '16px',
                    border: `1px dashed ${preset.surfaceBorder}`,
                    background: preset.accentSoftBg,
                    padding: '28px 22px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Lock size={22} strokeWidth={2.2} aria-hidden style={{ color: preset.accent }} />
                    <span style={{ fontSize: '16px', fontWeight: 900, color: preset.heading }}>{PUBLIC_STREAM_HUB_UPSELL.cardTitle}</span>
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: '14px', color: preset.body, lineHeight: 1.6, maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
                    {PUBLIC_STREAM_HUB_UPSELL.body}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: preset.muted, lineHeight: 1.5 }}>
                    {PUBLIC_STREAM_HUB_UPSELL.organizerHint}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'schedule' ? (
          <div style={{ paddingTop: '24px' }}>
            <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 900, color: preset.heading, margin: '0 0 18px', letterSpacing: '-0.02em' }}>
              Schedule & venues
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 9px',
                  borderRadius: '999px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.surfaceBg,
                  color: preset.body,
                }}
              >
                <span
                  aria-hidden
                  style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#7c3aed' }}
                />
                League game
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 9px',
                  borderRadius: '999px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.surfaceBg,
                  color: preset.body,
                }}
              >
                <span
                  aria-hidden
                  style={{ width: '8px', height: '8px', borderRadius: '999px', background: preset.accent }}
                />
                Drop-in
              </span>
            </div>

            {personalizedSchedule.length > 0 ? (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  background: preset.accentSoftBg,
                  border: `1px solid ${preset.surfaceBorder}`,
                  borderRadius: '12px',
                }}
              >
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: preset.heading, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Your upcoming games
                </p>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {personalizedSchedule.map((item) => {
                    const local = formatDropInSessionLocal(item.scheduled_at, org.league_timezone)
                    const label =
                      item.type === 'drop_in' && item.is_recurring ? dropinSeriesBaseName(item.name) : item.name
                    const rowHref =
                      item.type === 'drop_in'
                        ? `/join/${slug}/dropins`
                        : leagueSeasonGamePublicHref(slug, item.source_id)
                    return (
                      <div
                        key={`personal-${item.id}`}
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(rowHref)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            router.push(rowHref)
                          }
                        }}
                        style={{
                          fontSize: '13px',
                          color: preset.body,
                          cursor: 'pointer',
                          padding: '8px 10px',
                          margin: '0 -10px',
                          borderRadius: '8px',
                          outline: 'none',
                        }}
                      >
                        <strong style={{ color: preset.heading }}>{label}</strong> · {local.day} · {local.time}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {rankedScheduleItems.length === 0 ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: preset.surfaceBg,
                  borderRadius: '16px',
                  border: `1px solid ${preset.surfaceBorder}`,
                }}
              >
                <CalendarDays size={36} strokeWidth={1.25} style={{ color: preset.accent, marginBottom: '12px' }} aria-hidden />
                <p style={{ color: preset.heading, fontWeight: 800, margin: 0 }}>Nothing on the calendar yet</p>
                <p style={{ color: preset.muted, fontSize: '14px', margin: '8px 0 0' }}>
                  Upcoming games, drop-ins, and recent results appear here once your organizer publishes them.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {leagueScheduleDisplayRows.map((row) => {
                  if (row.kind === 'single') {
                    const item = row.item
                    const local = formatDropInSessionLocal(item.scheduled_at, org.league_timezone)
                    const isDropin = item.type === 'drop_in'
                    const loc = item.location_label
                    const cardHref = isDropin
                      ? `/join/${slug}/dropins`
                      : leagueSeasonGamePublicHref(slug, item.source_id)
                    const seasonStatus = !isDropin ? String(item.game_status || '').toLowerCase() : ''
                    const seasonScoreLine = !isDropin ? seasonGameScoreSummary(item) : null
                    return (
                      <div
                        key={item.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(cardHref)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            router.push(cardHref)
                          }
                        }}
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${item.is_user_playing ? preset.accent : preset.surfaceBorder}`,
                          borderRadius: '14px',
                          padding: '18px 20px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '14px',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: isDropin ? preset.accent : '#6d28d9',
                              background: isDropin ? preset.accentSoftBg : '#f3e8ff',
                              border: `1px solid ${preset.surfaceBorder}`,
                              borderRadius: '999px',
                              padding: '3px 8px',
                              marginBottom: '8px',
                            }}
                          >
                            {isDropin ? 'Drop-in' : 'League game'}
                          </span>
                          {item.is_user_playing ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '10px',
                                fontWeight: 900,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: preset.heading,
                                background: preset.accentSoftBg,
                                border: `1px solid ${preset.surfaceBorder}`,
                                borderRadius: '999px',
                                padding: '3px 8px',
                                marginLeft: '8px',
                                marginBottom: '8px',
                              }}
                            >
                              You&apos;re playing
                            </span>
                          ) : null}
                          {!isDropin && seasonStatus === 'live' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '10px',
                                fontWeight: 900,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#c2410c',
                                background: 'rgba(255,237,213,0.9)',
                                border: '1px solid rgba(234,88,12,0.35)',
                                borderRadius: '999px',
                                padding: '3px 8px',
                                marginLeft: '8px',
                                marginBottom: '8px',
                              }}
                            >
                              Live
                            </span>
                          ) : null}
                          <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: preset.heading }}>{item.name || 'Schedule item'}</p>
                          {seasonScoreLine ? (
                            <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: 800, color: preset.heading }}>{seasonScoreLine}</p>
                          ) : null}
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: preset.muted }}>
                            {local.day} · {local.time}
                            {local.zone ? ` ${local.zone}` : ''}
                          </p>
                          {loc ? (
                            <p style={{ margin: '8px 0 0', fontSize: '13px', color: preset.body, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: preset.accent }} aria-hidden />
                              <span>{loc}</span>
                            </p>
                          ) : null}
                          {isDropin && typeof item.fee_amount === 'number' ? (
                            <p style={{ margin: '10px 0 0', fontSize: '14px', fontWeight: 800, color: preset.accent }}>${item.fee_amount}</p>
                          ) : null}
                          {isDropin ? (
                            <p style={{ margin: '8px 0 0', fontSize: '13px', color: preset.muted }}>{dropinSignupSummary(item)}</p>
                          ) : null}
                        </div>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            padding: '10px 18px',
                            borderRadius: '10px',
                            background: isDropin ? preset.accent : preset.accentSoftBg,
                            color: isDropin ? contrastTextForAccent(preset.accent) : preset.accent,
                            border: isDropin ? 'none' : `1px solid ${preset.surfaceBorder}`,
                            flexShrink: 0,
                            alignSelf: 'flex-start',
                          }}
                        >
                          {isDropin ? (item.is_user_playing ? 'Manage spot →' : 'Reserve spot →') : 'Scoreboard →'}
                        </span>
                      </div>
                    )
                  }

                  const { base, items } = row
                  const clusterKey = `recur:${base}`
                  const next = items[0]!
                  const localNext = formatDropInSessionLocal(next.scheduled_at, org.league_timezone)
                  const anyPlaying = items.some((i) => i.is_user_playing)
                  const expanded = !!expandedScheduleCluster[clusterKey]
                  const moreCount = items.length - 1
                  const loc0 = next.location_label
                  const dropinHref = `/join/${slug}/dropins`
                  return (
                    <div
                      key={clusterKey}
                      role="link"
                      tabIndex={0}
                      onClick={(ev) => {
                        const el = ev.target as HTMLElement
                        if (el.closest?.('[data-schedule-expand]')) return
                        router.push(dropinHref)
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          router.push(dropinHref)
                        }
                      }}
                      style={{
                        background: preset.surfaceBg,
                        border: `1px solid ${anyPlaying ? preset.accent : preset.surfaceBorder}`,
                        borderRadius: '14px',
                        padding: '18px 20px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '14px',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: preset.accent,
                            background: preset.accentSoftBg,
                            border: `1px solid ${preset.surfaceBorder}`,
                            borderRadius: '999px',
                            padding: '3px 8px',
                            marginBottom: '8px',
                          }}
                        >
                          Repeating drop-in
                        </span>
                        {anyPlaying ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '10px',
                              fontWeight: 900,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: preset.heading,
                              background: preset.accentSoftBg,
                              border: `1px solid ${preset.surfaceBorder}`,
                              borderRadius: '999px',
                              padding: '3px 8px',
                              marginLeft: '8px',
                              marginBottom: '8px',
                            }}
                          >
                            You&apos;re playing
                          </span>
                        ) : null}
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: preset.heading }}>{base}</p>
                        <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 800, color: preset.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Next session
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: preset.body }}>
                          {localNext.day} · {localNext.time}
                          {localNext.zone ? ` ${localNext.zone}` : ''}
                        </p>
                        {loc0 ? (
                          <p style={{ margin: '8px 0 0', fontSize: '13px', color: preset.body, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: preset.accent }} aria-hidden />
                            <span>{loc0}</span>
                          </p>
                        ) : null}
                        {typeof next.fee_amount === 'number' ? (
                          <p style={{ margin: '10px 0 0', fontSize: '14px', fontWeight: 800, color: preset.accent }}>${next.fee_amount}</p>
                        ) : null}
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: preset.muted }}>{dropinSignupSummary(next)}</p>
                        {moreCount > 0 ? (
                          <div style={{ marginTop: '12px' }}>
                            <button
                              type="button"
                              data-schedule-expand
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedScheduleCluster((prev) => ({
                                  ...prev,
                                  [clusterKey]: !prev[clusterKey],
                                }))
                              }}
                              style={{
                                background: 'transparent',
                                border: `1px solid ${preset.surfaceBorder}`,
                                borderRadius: '10px',
                                padding: '10px 14px',
                                fontSize: '13px',
                                fontWeight: 800,
                                color: preset.heading,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                touchAction: 'manipulation',
                                minHeight: '44px',
                              }}
                            >
                              {expanded ? 'Hide extra dates' : `Show ${moreCount} more date${moreCount === 1 ? '' : 's'}`}
                            </button>
                            {expanded ? (
                              <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: preset.body, fontSize: '13px', lineHeight: 1.6 }}>
                                {items.slice(1).map((ex) => {
                                  const locEx = formatDropInSessionLocal(ex.scheduled_at, org.league_timezone)
                                  return (
                                    <li key={ex.id}>
                                      {locEx.day} · {locEx.time}
                                      {locEx.zone ? ` ${locEx.zone}` : ''}
                                      <span style={{ color: preset.muted }}> — {dropinSignupSummary(ex)}</span>
                                      {ex.is_user_playing ? (
                                        <span style={{ marginLeft: '6px', fontWeight: 800, color: preset.accent }}>(You&apos;re in)</span>
                                      ) : null}
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          padding: '10px 18px',
                          borderRadius: '10px',
                          background: preset.accent,
                          color: contrastTextForAccent(preset.accent),
                          flexShrink: 0,
                          alignSelf: 'flex-start',
                        }}
                      >
                        {anyPlaying ? 'Manage spot →' : 'Reserve spot →'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <p style={{ marginTop: '28px', fontSize: '13px', color: preset.muted }}>
              Need the full signup flow?{' '}
              <Link href={`/join/${slug}/dropins`} style={{ fontWeight: 800, color: preset.accent }}>
                Open drop-ins
              </Link>
            </p>
          </div>
        ) : null}

        {activeTab === 'news' ? (
          <div style={{ paddingTop: '28px' }}>
            <h2
              style={{
                fontSize: 'clamp(20px, 2.5vw, 24px)',
                fontWeight: 900,
                color: preset.heading,
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
                fontFamily: portalOriginalLayout ? publicHeadingFontStack : undefined,
              }}
            >
              League news
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '560px' }}>
              Weekly updates from organizers. Team pages also surface these league updates on their News tabs.
            </p>
            {editMode && draftSite && !websiteLockedForPlan ? (
              <LeagueSiteSectionsEditor
                value={draftSite}
                onChange={setDraftSite}
                preset={preset}
                maxGalleryImages={draftGalleryLimit}
                organizationId={org.id}
                showAddToolbar={false}
                maxWidth={leagueContentMax}
                subsetMode="news"
                onSectionAdded={handleDraftSectionCreated}
                onNavigateToCreativeSurface={(surf) => setLeagueTab(leaguePublicTabForCreativeSurface(surf))}
                posterLayout={portalOriginalLayout}
                headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
              />
            ) : newsSections.length > 0 ? (
              <LeagueSiteSections
                site={{ ...displaySite, sections: newsSections }}
                preset={preset}
                maxWidth={leagueContentMax}
                posterLayout={portalOriginalLayout}
                headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
              />
            ) : (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: preset.surfaceBg,
                  border: `1px dashed ${preset.surfaceBorder}`,
                  borderRadius: '16px',
                }}
              >
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: preset.heading }}>No league news posted yet</p>
                <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55 }}>
                  Organizers can add a block from <strong style={{ color: preset.heading }}>Edit page</strong> while on the News tab (Quick Add), or publish from the dashboard.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'standings' ? (
          <div style={{ paddingTop: '24px' }}>
            {isProLike ? (
              <>
                <h2
                  style={{
                    fontSize: 'clamp(20px, 2.5vw, 24px)',
                    fontWeight: 900,
                    color: preset.heading,
                    margin: '0 0 12px',
                    letterSpacing: '-0.02em',
                    fontFamily: portalOriginalLayout ? publicHeadingFontStack : undefined,
                  }}
                >
                  Standings
                </h2>
                {competitiveSeason ? (
                  <p style={{ margin: '-4px 0 16px', fontSize: '13px', color: preset.muted, lineHeight: 1.45, maxWidth: '640px' }}>
                    Rankings and game history use <strong style={{ color: preset.body }}>{competitiveSeason.name}</strong> only—the season this league highlights for registration—so older seasons are not mixed into this table.
                  </p>
                ) : null}
                <div
                  role="tablist"
                  aria-label="Standings sections"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '18px',
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={standingsInnerTab === 'overview'}
                    onClick={() => setStandingsInnerTab('overview')}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      border: `1px solid ${standingsInnerTab === 'overview' ? preset.accent : preset.surfaceBorder}`,
                      background: standingsInnerTab === 'overview' ? preset.accentSoftBg : preset.surfaceBg,
                      color: preset.heading,
                      minHeight: '44px',
                      boxSizing: 'border-box',
                    }}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={standingsInnerTab === 'history'}
                    onClick={() => setStandingsInnerTab('history')}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      border: `1px solid ${standingsInnerTab === 'history' ? preset.accent : preset.surfaceBorder}`,
                      background: standingsInnerTab === 'history' ? preset.accentSoftBg : preset.surfaceBg,
                      color: preset.heading,
                      minHeight: '44px',
                      boxSizing: 'border-box',
                    }}
                  >
                    History
                  </button>
                </div>

                {standingsInnerTab === 'overview' ? (
                  <>
                    <p style={{ margin: '0 0 20px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '560px' }}>
                      Ties share the same place number. <strong style={{ color: preset.body }}>GB</strong> is games behind the first-place team (— when even or no games yet).
                    </p>
                    {standingsRows.length > 0 ? (
                      <div
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '16px',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                          <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                              <tr style={{ background: preset.accentSoftBg, color: preset.body, textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px', fontWeight: 800, whiteSpace: 'nowrap' }} title="Place (ties share a number)">
                                  #
                                </th>
                                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Team</th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }} title="Games played">
                                  GP
                                </th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>W</th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>L</th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }} title="Winning percentage">
                                  PCT
                                </th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }} title="Games behind first place">
                                  GB
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {standingsDisplayRows.map(({ row, rank, gp, gbDisplay, pctDisplay }) => (
                                <tr key={row.team_id} style={{ borderTop: `1px solid ${preset.surfaceBorder}` }}>
                                  <td style={{ padding: '10px 12px', color: preset.muted, fontVariantNumeric: 'tabular-nums' }}>{rank}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                                    <Link
                                      href={`/league/${slug}/teams/${row.team_id}`}
                                      style={{ color: preset.heading, textDecoration: 'none', fontWeight: 700 }}
                                    >
                                      {row.team_name}
                                    </Link>
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums' }}>{gp}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums' }}>{row.wins}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums' }}>{row.losses}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums' }}>{pctDisplay}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.muted, fontVariantNumeric: 'tabular-nums' }}>{gbDisplay}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '16px',
                          padding: '28px 24px',
                          textAlign: 'center',
                        }}
                      >
                        <BarChart3 size={32} strokeWidth={1.5} style={{ color: preset.accent, margin: '0 auto 12px' }} aria-hidden />
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: preset.heading }}>Standings go live with game results</p>
                        <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                          Your organizer records scores from the dashboard; this hub will fill in as that data rolls out.
                        </p>
                      </div>
                    )}
                    {leadersRows.length > 0 ? (
                      <div
                        style={{
                          marginTop: '14px',
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '14px',
                          padding: '12px 14px',
                        }}
                      >
                        <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: preset.muted }}>
                          Current leaders
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {leadersRows.map((row) => (
                            <span key={`${row.stat}-${row.player_name}`} style={{ fontSize: '13px', color: preset.body }}>
                              <strong style={{ color: preset.heading }}>{row.stat}</strong>: {row.player_name} ({Math.round(row.total)})
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 20px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '560px' }}>
                      Final scores with both teams tallied (newest first). Open a row for the full public recap on the <strong style={{ color: preset.body }}>Stream</strong> tab.
                    </p>
                    {gameResults.length === 0 ? (
                      <div
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '16px',
                          padding: '28px 24px',
                          textAlign: 'center',
                        }}
                      >
                        <CalendarDays size={32} strokeWidth={1.5} style={{ color: preset.accent, margin: '0 auto 12px' }} aria-hidden />
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: preset.heading }}>No completed games yet</p>
                        <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                          When organizers mark games final, results appear here automatically.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {gameResults.map((g) => {
                          const local = formatDropInSessionLocal(g.scheduled_at, org.league_timezone)
                          const scoreLine = `${g.away_score}–${g.home_score}`
                          return (
                            <Link
                              key={g.game_id}
                              href={`/league/${encodeURIComponent(slug)}?tab=stream&game=${encodeURIComponent(g.game_id)}`}
                              style={{
                                display: 'block',
                                textDecoration: 'none',
                                background: preset.surfaceBg,
                                border: `1px solid ${preset.surfaceBorder}`,
                                borderRadius: '14px',
                                padding: '16px 18px',
                                color: preset.body,
                                boxShadow: '0 8px 24px -18px rgba(0,0,0,0.12)',
                              }}
                            >
                              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: preset.muted }}>
                                {local.day} · {local.time}
                                {local.zone ? ` ${local.zone}` : ''}
                              </p>
                              <p style={{ margin: '8px 0 4px', fontSize: '16px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>
                                {g.away_team_name} @ {g.home_team_name}
                              </p>
                              <p style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: preset.heading }}>{scoreLine}</p>
                              <p style={{ margin: '10px 0 0', fontSize: '12px', fontWeight: 800, color: preset.accent }}>Stream tab →</p>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <h2
                  style={{
                    fontSize: 'clamp(20px, 2.5vw, 24px)',
                    fontWeight: 900,
                    color: preset.heading,
                    margin: '0 0 8px',
                    letterSpacing: '-0.02em',
                    fontFamily: portalOriginalLayout ? publicHeadingFontStack : undefined,
                  }}
                >
                  Standings & leaders
                </h2>
                <div
                  style={{
                    background: preset.surfaceBg,
                    border: `1px solid ${preset.surfaceBorder}`,
                    borderRadius: '16px',
                    padding: '26px 24px',
                    boxShadow: '0 10px 28px -20px rgba(0,0,0,0.18)',
                  }}
                >
                  <BarChart3 size={28} strokeWidth={1.5} style={{ color: preset.accent, marginBottom: '12px' }} aria-hidden />
                  <p style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 900, color: preset.heading }}>Built for competition coverage</p>
                  <p style={{ margin: 0, fontSize: '14px', color: preset.body, lineHeight: 1.6 }}>
                    Live standings, records, and league leaders on your public site are part of <strong style={{ color: preset.heading }}>Pro</strong> and{' '}
                    <strong style={{ color: preset.heading }}>Enterprise</strong>. Basic leagues still get a full{' '}
                    <button
                      type="button"
                      onClick={() => setLeagueTab('home')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 800,
                        color: preset.accent,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Home
                    </button>{' '}
                    experience — news, teams, and registration — without cluttering the page.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'teams' ? (
          <div style={{ paddingTop: '24px' }}>
            {competitiveSeason ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 'clamp(22px, 3vw, 26px)', fontWeight: 900, color: preset.heading, margin: 0, letterSpacing: '-0.02em' }}>
                    Season headquarters
                  </h2>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: preset.body, fontWeight: 700, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldHalf size={15} /> {teams.length} Teams
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={15} /> {totalPlayers} Players
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    background: `linear-gradient(145deg, ${preset.surfaceBg} 0%, ${preset.accentSoftBg} 120%)`,
                    border: `1px solid ${preset.surfaceBorder}`,
                    borderRadius: '18px',
                    padding: '22px',
                    boxShadow: '0 12px 32px -20px rgba(0,0,0,0.28)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: preset.accent, boxShadow: `0 0 0 3px ${preset.accentSoftBg}` }} />
                    <p style={{ margin: 0, fontSize: '17px', color: preset.heading, fontWeight: 900, letterSpacing: '-0.02em' }}>{competitiveSeason.name}</p>
                  </div>
                  {seasonDates ? <p style={{ margin: '0 0 18px', fontSize: '13px', color: preset.muted }}>{seasonDates}</p> : null}
                  <p style={{ margin: 0, fontSize: '11px', color: preset.muted, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Team directory — tap for roster
                  </p>
                </div>
              </div>
            ) : null}

            {teams.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                {teams.map((t) => {
                  const teamAccent = t.color || accent
                  return (
                    <Link key={t.id} href={`/league/${slug}/teams/${t.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        style={{
                          background: preset.surfaceBg,
                          borderTop: `1px solid ${preset.surfaceBorder}`,
                          borderRight: `1px solid ${preset.surfaceBorder}`,
                          borderBottom: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '16px',
                          padding: '14px 14px 14px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          boxShadow: '0 12px 32px -22px rgba(0,0,0,0.42)',
                          borderLeft: `5px solid ${teamAccent}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '12px',
                              flexShrink: 0,
                              background: `${teamAccent}1a`,
                              border: `1px solid ${preset.surfaceBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}
                            aria-hidden
                          >
                            {t.logo_url ? (
                               
                              <img src={t.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '15px', fontWeight: 900, color: contrastTextForAccent(teamAccent), background: teamAccent, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {t.name.trim().charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: preset.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: '12px', color: preset.muted, fontWeight: 700 }}>
                              {t.season_name || 'Season'}
                            </div>
                            <div style={{ fontSize: '12px', color: preset.body, fontWeight: 600, marginTop: '1px' }}>
                              {t.player_count} player{t.player_count === 1 ? '' : 's'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={16} color={preset.muted} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p
                style={{
                  fontSize: '13px',
                  color: preset.body,
                  margin: '0 0 8px',
                  lineHeight: 1.5,
                  background: preset.surfaceBg,
                  border: `1px dashed ${preset.surfaceBorder}`,
                  borderRadius: '12px',
                  padding: '14px',
                  textAlign: 'center',
                }}
              >
                Team pages will appear here once your organizer adds teams.
              </p>
            )}
          </div>
        ) : null}

        {activeTab === 'about' ? (
          <div style={{ paddingTop: aboutSections.length || editMode ? '28px' : '24px' }}>
            {editMode && draftSite && websiteLockedForPlan ? (
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: '14px',
                    border: `1px solid ${preset.surfaceBorder}`,
                    background: preset.accentSoftBg,
                    fontSize: '14px',
                    color: preset.body,
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: preset.heading }}>Custom About content</strong> (text, news, galleries) is a{' '}
                  <strong style={{ color: preset.heading }}>Pro / Enterprise</strong> feature. Visitors on Basic still see your teams and registration flows with MyLeaguePortal house branding.{' '}
                  <Link href="/dashboard/settings" style={{ fontWeight: 800, color: preset.accent }}>
                    Upgrade in Settings
                  </Link>{' '}
                  to edit.
                </div>
                {hub.leagueSite.sections.filter((sec) => !isLeagueSiteNewsSurfaceSection(sec)).length > 0 ? (
                  <div style={{ marginTop: '18px', opacity: 0.85 }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: preset.muted, marginBottom: '12px' }}>
                      Published About content (read-only preview)
                    </p>
                    <LeagueSiteSections
                      site={{
                        ...hub.leagueSite,
                        sections: hub.leagueSite.sections.filter((sec) => !isLeagueSiteNewsSurfaceSection(sec)),
                      }}
                      preset={preset}
                      maxWidth={leagueContentMax}
                      posterLayout={portalOriginalLayout}
                      headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
                    />
                  </div>
                ) : null}
              </div>
            ) : editMode && draftSite && !websiteLockedForPlan ? (
              <LeagueSiteSectionsEditor
                value={draftSite}
                onChange={setDraftSite}
                preset={preset}
                maxGalleryImages={draftGalleryLimit}
                organizationId={org.id}
                showAddToolbar={false}
                maxWidth={leagueContentMax}
                subsetMode="about"
                onSectionAdded={handleDraftSectionCreated}
                onNavigateToCreativeSurface={(surf) => setLeagueTab(leaguePublicTabForCreativeSurface(surf))}
                posterLayout={portalOriginalLayout}
                headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
              />
            ) : aboutSections.length > 0 ? (
              <LeagueSiteSections
                site={{ ...displaySite, sections: aboutSections }}
                preset={preset}
                maxWidth={leagueContentMax}
                posterLayout={portalOriginalLayout}
                headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
              />
            ) : (
              <div
                style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  background: preset.surfaceBg,
                  border: `1px dashed ${preset.surfaceBorder}`,
                  borderRadius: '16px',
                }}
              >
                <Info size={32} strokeWidth={1.25} style={{ color: preset.muted, margin: '0 auto 12px' }} aria-hidden />
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: preset.heading }}>No About sections yet</p>
                <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Add text or media sections in Edit page to tell the league story and showcase evergreen content.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: '48px',
          padding: '28px 24px 36px',
          background: heroTheme.footerBarBg,
          borderTop: `1px solid ${preset.surfaceBorder}`,
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '13px',
            color: heroTheme.footerBarText,
            margin: 0,
            lineHeight: 1.5,
            maxWidth: '480px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Questions? Contact your league organizer.
        </p>
        <p
          style={{
            textAlign: 'center',
            fontSize: '11px',
            color: heroTheme.footerBarText,
            marginTop: '10px',
            marginBottom: 0,
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          Powered by MyLeaguePortal
        </p>
      </div>

      {canManageSite && !editMode && accessResolved ? (
        <Link
          href={leaguePathWithEditQuery}
          style={{
            position: 'fixed',
            bottom: '22px',
            right: '22px',
            zIndex: 55,
            padding: '12px 18px',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 800,
            textDecoration: 'none',
            background: preset.accent,
            color: contrastTextForAccent(preset.accent),
            boxShadow: '0 10px 28px -12px rgba(0,0,0,0.45)',
          }}
        >
          Edit page
        </Link>
      ) : null}
    </div>
  )
}

export default function LeagueHomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Loading…
        </div>
      }
    >
      <LeagueHomeContent />
    </Suspense>
  )
}
