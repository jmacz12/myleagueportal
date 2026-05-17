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
  ChevronDown,
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
import { PublicSectionTabBar } from '@/components/public/PublicSectionTabBar'
import {
  PublicSectionMobileMenu,
  usePublicSectionMobileLayout,
} from '@/components/public/PublicSectionMobileMenu'
import { MediaGalleryPublic } from '@/components/league-site/MediaGalleryPublic'
import { leagueSiteCreativeStageMinHeightCss } from '@/lib/league-site-creative-canvas'
import { LeagueNotFoundOrganizerHint } from '@/components/LeagueNotFoundOrganizerHint'
import { LeaguePublicAuthBar } from '@/components/league-site/LeaguePublicAuthBar'
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
  LeagueSiteNewsArticleSection,
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
  isLeagueSiteNewsArticleSection,
  isLeagueSiteNewsSurfaceSection,
  resolveLeagueSiteContentBlockTextColor,
  sanitizeLeagueSiteCtaHref,
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

  if (section.type === 'cta') {
    const href = sanitizeLeagueSiteCtaHref(section.buttonHref)
    const btn = section.buttonLabel.trim()
    const hasBtn = btn.length > 0 && href.length > 0
    const internal = href.startsWith('/')
    const sidePad = posterLayout ? '20px 22px 22px' : '24px 24px 26px'
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
        <div
          style={{
            padding: sidePad,
            background: `linear-gradient(125deg, ${preset.accentSoftBg} 0%, ${preset.surfaceBg} 55%, ${preset.surfaceBg} 100%)`,
          }}
        >
          {section.title.trim() ? <h2 style={{ ...h2Style, marginBottom: section.body.trim() ? '12px' : hasBtn ? '16px' : 0 }}>{section.title}</h2> : null}
          {section.body.trim() ? (
            <div style={{ marginBottom: hasBtn ? '18px' : 0 }}>{bodyText(section.body)}</div>
          ) : null}
          {hasBtn ? (
            internal ? (
              <Link
                href={href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 22px',
                  borderRadius: '999px',
                  background: preset.accent,
                  color: contrastTextForAccent(preset.accent),
                  fontWeight: 800,
                  fontSize: '15px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                }}
              >
                {btn}
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 22px',
                  borderRadius: '999px',
                  background: preset.accent,
                  color: contrastTextForAccent(preset.accent),
                  fontWeight: 800,
                  fontSize: '15px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                }}
              >
                {btn}
              </a>
            )
          ) : null}
        </div>
      </section>
    )
  }

  if (section.type === 'divider') {
    const lab = section.label.trim()
    const labEl =
      lab.length > 0 ? (
        <span
          style={{
            fontSize: posterLayout ? '11px' : '12px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: preset.muted,
            whiteSpace: 'nowrap',
            padding: '0 10px',
          }}
        >
          {lab}
        </span>
      ) : null
    if (section.variant === 'space') {
      return (
        <div
          style={{
            marginBottom: posterLayout ? '20px' : '24px',
            minHeight: lab ? '28px' : '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {labEl}
        </div>
      )
    }
    return (
      <div
        style={{
          marginBottom: posterLayout ? '20px' : '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
        }}
      >
        <div style={{ flex: 1, height: '1px', background: preset.surfaceBorder }} aria-hidden />
        {labEl}
        <div style={{ flex: 1, height: '1px', background: preset.surfaceBorder }} aria-hidden />
      </div>
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
            border: `1px solid ${preset.accent}`,
            color: contrastTextForAccent(preset.accent),
            background: preset.accent,
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
  const [standingsDataError, setStandingsDataError] = useState(false)
  const [gameResults, setGameResults] = useState<LeagueGameResultRow[]>([])
  const [standingsInnerTab, setStandingsInnerTab] = useState<LeagueStandingsInnerTab>('overview')
  const [leadersRows, setLeadersRows] = useState<LeagueLeaderRow[]>([])
  const [streamLive, setStreamLive] = useState<JoinStreamLivePayload | null>(null)
  const streamLiveTeaserLine = useMemo(
    () => (streamLive ? joinStreamLiveTeaserLine(streamLive) : null),
    [streamLive]
  )

  const standingsDisplayRows = useMemo(() => buildLeagueStandingsDisplayRows(standingsRows), [standingsRows])

  const standingsTableAllUnplayed = useMemo(
    () => standingsRows.length > 0 && standingsRows.every((r) => r.wins + r.losses === 0),
    [standingsRows]
  )

  const STANDINGS_HISTORY_PAGE_SIZE = 5
  const [standingsHistoryExpanded, setStandingsHistoryExpanded] = useState(false)
  const standingsHistoryVisible = useMemo(
    () =>
      standingsHistoryExpanded ? gameResults : gameResults.slice(0, STANDINGS_HISTORY_PAGE_SIZE),
    [gameResults, standingsHistoryExpanded]
  )

  const [stickyVisible, setStickyVisible] = useState(false)
  const isMobileLayout = usePublicSectionMobileLayout()
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
      setStandingsDataError(false)
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
        setStandingsDataError(!standingsRes.ok)
        if (standingsRes.ok) {
          setStandingsRows(Array.isArray(standingsJson.standings) ? standingsJson.standings : [])
          setGameResults(normalizeLeagueGameResults(standingsJson.gameResults))
          setLeadersRows(Array.isArray(standingsJson.leaders) ? standingsJson.leaders : [])
        } else {
          setStandingsRows([])
          setGameResults([])
          setLeadersRows([])
        }
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

  useEffect(() => {
    setStandingsHistoryExpanded(false)
  }, [slug, standingsInnerTab])

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
  }, [hub?.organization, refreshStreamLive])

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
  }, [hub?.organization, streamLive?.gameId, refreshStreamLive])

  useEffect(() => {
    if (!hub?.organization || !isProOrEnterprise(hub.organization.plan)) return
    if (activeTab !== 'stream' || !streamLive?.gameId) return
    const id = window.setInterval(() => {
      void refreshStreamLive()
    }, 2000)
    return () => window.clearInterval(id)
  }, [activeTab, streamLive?.gameId, refreshStreamLive, hub?.organization])

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
  const latestNewsSection = useMemo((): LeagueSiteNewsArticleSection | null => {
    return displaySite.sections.find(isLeagueSiteNewsArticleSection) ?? null
  }, [displaySite.sections])
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
      <LeaguePublicAuthBar preset={preset} canManageSite={canManageSite} accessResolved={accessResolved} />

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

      {!editMode && isMobileLayout ? (
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
          padding: '10px 14px',
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
          <PublicSectionMobileMenu
            active={activeTab}
            onChange={setLeagueTab}
            tabs={leagueTabsForBar}
            preset={preset}
            headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
            menuAlign="right"
            compact
          />
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

      <PublicSectionTabBar
        active={activeTab}
        onChange={setLeagueTab}
        tabs={leagueTabsForBar}
        preset={preset}
        maxWidth={leagueContentMax}
        headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
        ariaLabel="League sections"
        mobileMenuInStickyBar={isMobileLayout && stickyVisible}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: preset.heading, fontWeight: 700, fontSize: '14px' }}>
                      <span>View schedule</span>
                      <ChevronRight size={18} />
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '26px' }}>
              {isProLike && streamLive ? (
                <Link
                  href={leagueSeasonGamePublicHref(slug, streamLive.gameId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                    padding: '16px 18px',
                    borderRadius: '16px',
                    textDecoration: 'none',
                    background: preset.surfaceBg,
                    border: `1px solid ${preset.surfaceBorder}`,
                    boxShadow: `0 0 0 1px ${preset.accent}33, 0 14px 36px -24px rgba(0,0,0,0.25)`,
                    color: preset.heading,
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: '1 1 200px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 900,
                          letterSpacing: '0.12em',
                          color: contrastTextForAccent(preset.accent),
                          background: preset.accent,
                          padding: '5px 10px',
                          borderRadius: '8px',
                        }}
                      >
                        LIVE
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        {streamLive.awayName || 'Away'} <span style={{ color: preset.muted, fontWeight: 800 }}>@</span>{' '}
                        {streamLive.homeName || 'Home'}
                      </span>
                    </span>
                    {streamLiveTeaserLine ? (
                      <span style={{ fontSize: '14px', fontWeight: 800, color: preset.body, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                        {streamLiveTeaserLine}
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: preset.muted }}>Open the Stream tab for live box score and video.</span>
                    )}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: preset.accent, flexShrink: 0 }}>Stream →</span>
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
                                color: contrastTextForAccent(preset.accent),
                                background: preset.accent,
                                border: `1px solid ${preset.accent}`,
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
                    These standings use <strong style={{ color: preset.body }}>{competitiveSeason.name}</strong> only (the season open for sign-up). Past seasons are not mixed in.
                  </p>
                ) : null}
                {standingsDataError ? (
                  <div
                    role="alert"
                    style={{
                      marginBottom: '18px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: `1px solid ${preset.surfaceBorder}`,
                      background: preset.accentSoftBg,
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      maxWidth: '640px',
                    }}
                  >
                    <Info size={20} strokeWidth={2} style={{ color: preset.accent, flexShrink: 0, marginTop: '2px' }} aria-hidden />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: preset.heading }}>Couldn&apos;t load standings</p>
                      <p style={{ margin: '6px 0 0', fontSize: '13px', color: preset.muted, lineHeight: 1.5 }}>
                        Refresh the page and try again.
                      </p>
                    </div>
                  </div>
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
                    <div
                      style={{
                        margin: '0 0 22px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: preset.accentSoftBg,
                        border: `1px solid ${preset.surfaceBorder}`,
                        maxWidth: '640px',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '13px', color: preset.muted, lineHeight: 1.55 }}>
                        Teams with the same record share a rank. <strong style={{ color: preset.body }}>GB</strong> means games behind first place. A dash (—) means tied for first or no games played yet.
                      </p>
                    </div>
                    {standingsTableAllUnplayed ? (
                      <div
                        style={{
                          margin: '0 0 18px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: `1px dashed ${preset.surfaceBorder}`,
                          background: preset.surfaceBg,
                          maxWidth: '640px',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '13px', color: preset.body, lineHeight: 1.55 }}>
                          No games are final yet. Everyone is still <strong style={{ color: preset.heading }}>0–0</strong>. Win % and games-behind fill in after the first finished game.
                        </p>
                      </div>
                    ) : null}
                    {standingsRows.length > 0 ? (
                      <div
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '18px',
                          overflow: 'hidden',
                          boxShadow: '0 14px 40px -28px rgba(0,0,0,0.22)',
                        }}
                      >
                        <div
                          style={{
                            padding: '16px 20px',
                            borderBottom: `1px solid ${preset.surfaceBorder}`,
                            background: `linear-gradient(135deg, ${preset.accentSoftBg} 0%, transparent 55%)`,
                          }}
                        >
                          <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: preset.muted }}>
                            Season table
                          </p>
                          <p style={{ margin: '6px 0 0', fontSize: '17px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>
                            Team standings
                          </p>
                        </div>
                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                          <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                              <tr style={{ color: preset.muted, textAlign: 'left' }}>
                                <th
                                  style={{ padding: '12px 10px 12px 20px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                                  title="Place (ties share a number)"
                                >
                                  Rank
                                </th>
                                <th style={{ padding: '12px 10px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Team</th>
                                <th
                                  style={{ padding: '12px 10px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}
                                  title="Games played"
                                >
                                  GP
                                </th>
                                <th style={{ padding: '12px 10px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>W</th>
                                <th style={{ padding: '12px 10px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>L</th>
                                <th
                                  style={{ padding: '12px 10px', fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}
                                  title="Winning percentage"
                                >
                                  PCT
                                </th>
                                <th
                                  style={{
                                    padding: '12px 20px 12px 10px',
                                    fontWeight: 800,
                                    fontSize: '11px',
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Games behind first place"
                                >
                                  GB
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {standingsDisplayRows.map(({ row, rank, gp, gbDisplay, pctDisplay }, idx) => {
                                const rankChipBg =
                                  rank === 1 ? preset.accent : rank <= 3 ? preset.accentSoftBg : 'transparent'
                                const rankChipColor =
                                  rank === 1 ? contrastTextForAccent(preset.accent) : rank <= 3 ? preset.heading : preset.muted
                                const rankChipBorder =
                                  rank === 1 || rank <= 3 ? 'none' : `1px solid ${preset.surfaceBorder}`
                                return (
                                  <tr
                                    key={row.team_id}
                                    style={{
                                      borderTop: `1px solid ${preset.surfaceBorder}`,
                                      background: idx % 2 === 0 ? 'transparent' : `${preset.accentSoftBg}40`,
                                    }}
                                  >
                                    <td style={{ padding: '14px 10px 14px 20px', verticalAlign: 'middle' }}>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          minWidth: '36px',
                                          height: '36px',
                                          borderRadius: '10px',
                                          fontSize: '14px',
                                          fontWeight: 900,
                                          fontVariantNumeric: 'tabular-nums',
                                          background: rankChipBg,
                                          color: rankChipColor,
                                          border: rankChipBorder,
                                          boxSizing: 'border-box',
                                        }}
                                      >
                                        {rank}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 10px', fontWeight: 800, verticalAlign: 'middle' }}>
                                      <Link
                                        href={`/league/${slug}/teams/${row.team_id}`}
                                        style={{
                                          color: preset.heading,
                                          textDecoration: 'none',
                                          fontWeight: 800,
                                          borderBottom: `1px solid transparent`,
                                        }}
                                      >
                                        {row.team_name}
                                      </Link>
                                    </td>
                                    <td style={{ padding: '14px 10px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{gp}</td>
                                    <td style={{ padding: '14px 10px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{row.wins}</td>
                                    <td style={{ padding: '14px 10px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{row.losses}</td>
                                    <td style={{ padding: '14px 10px', textAlign: 'center', color: preset.body, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{pctDisplay}</td>
                                    <td style={{ padding: '14px 20px 14px 10px', textAlign: 'center', color: preset.muted, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{gbDisplay}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '18px',
                          padding: '32px 24px',
                          textAlign: 'center',
                          boxShadow: '0 14px 40px -28px rgba(0,0,0,0.18)',
                        }}
                      >
                        <BarChart3 size={36} strokeWidth={1.5} style={{ color: preset.accent, margin: '0 auto 14px' }} aria-hidden />
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>No games recorded yet</p>
                        <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                          After the organizer saves final scores, this table fills in.
                        </p>
                      </div>
                    )}
                    {leadersRows.length > 0 ? (
                      <div style={{ marginTop: '28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                          <Trophy size={22} strokeWidth={2} style={{ color: preset.accent }} aria-hidden />
                          <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: preset.muted }}>Leaders</p>
                            <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>Current leaders</p>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '12px',
                          }}
                        >
                          {leadersRows.map((row) => (
                            <div
                              key={`${row.stat}-${row.player_name}`}
                              style={{
                                background: preset.surfaceBg,
                                border: `1px solid ${preset.surfaceBorder}`,
                                borderRadius: '14px',
                                padding: '16px 18px',
                                boxShadow: '0 10px 28px -22px rgba(0,0,0,0.2)',
                              }}
                            >
                              <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: preset.muted }}>{row.stat}</p>
                              <p style={{ margin: '10px 0 4px', fontSize: '16px', fontWeight: 900, color: preset.heading, lineHeight: 1.25 }}>{row.player_name}</p>
                              <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: preset.accent, fontVariantNumeric: 'tabular-nums' }}>{Math.round(row.total)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        margin: '0 0 22px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: preset.accentSoftBg,
                        border: `1px solid ${preset.surfaceBorder}`,
                        maxWidth: '640px',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '13px', color: preset.muted, lineHeight: 1.55 }}>
                        Finished games, newest first. Tap a game to open scores on the <strong style={{ color: preset.body }}>Stream</strong> tab.
                      </p>
                    </div>
                    {gameResults.length === 0 ? (
                      <div
                        style={{
                          background: preset.surfaceBg,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '18px',
                          padding: '32px 24px',
                          textAlign: 'center',
                          boxShadow: '0 14px 40px -28px rgba(0,0,0,0.18)',
                        }}
                      >
                        <CalendarDays size={36} strokeWidth={1.5} style={{ color: preset.accent, margin: '0 auto 14px' }} aria-hidden />
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>No completed games yet</p>
                        <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                          When organizers mark games final, results appear here automatically.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {standingsHistoryVisible.map((g) => {
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
                                borderRadius: '16px',
                                padding: '18px 20px',
                                color: preset.body,
                                boxShadow: '0 12px 32px -24px rgba(0,0,0,0.2)',
                              }}
                            >
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px 16px' }}>
                                <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: preset.muted }}>
                                  {local.day} · {local.time}
                                  {local.zone ? ` ${local.zone}` : ''}
                                </p>
                                <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: preset.heading, fontVariantNumeric: 'tabular-nums' }}>{scoreLine}</p>
                              </div>
                              <p style={{ margin: '12px 0 0', fontSize: '17px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                                {g.away_team_name} <span style={{ color: preset.muted, fontWeight: 800 }}>@</span> {g.home_team_name}
                              </p>
                              <p style={{ margin: '12px 0 0', fontSize: '12px', fontWeight: 800, color: preset.accent }}>View recap on Stream →</p>
                            </Link>
                          )
                        })}
                        {gameResults.length > STANDINGS_HISTORY_PAGE_SIZE ? (
                          <button
                            type="button"
                            aria-expanded={standingsHistoryExpanded}
                            onClick={() => setStandingsHistoryExpanded((prev) => !prev)}
                            style={{
                              marginTop: '4px',
                              alignSelf: 'center',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '12px 22px',
                              borderRadius: '12px',
                              fontSize: '14px',
                              fontWeight: 800,
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                              border: `1px solid ${preset.surfaceBorder}`,
                              background: preset.surfaceBg,
                              color: preset.heading,
                              boxShadow: '0 8px 22px -16px rgba(0,0,0,0.15)',
                            }}
                          >
                            {standingsHistoryExpanded ? 'Show less' : 'Click for more'}
                            <ChevronDown
                              size={18}
                              strokeWidth={2.5}
                              aria-hidden
                              style={{
                                color: preset.accent,
                                transform: standingsHistoryExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s ease',
                              }}
                            />
                          </button>
                        ) : null}
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
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  background: preset.surfaceBg,
                  borderRadius: '16px',
                  border: `1px solid ${preset.surfaceBorder}`,
                }}
              >
                <Users size={36} strokeWidth={1.25} style={{ color: preset.accent, marginBottom: '12px' }} aria-hidden />
                <p style={{ color: preset.heading, fontWeight: 800, margin: 0, fontSize: '16px' }}>No teams yet</p>
                <p style={{ color: preset.muted, fontSize: '14px', margin: '8px 0 0', lineHeight: 1.55, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Team cards will show up here once your organizer adds teams to this league.
                </p>
              </div>
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
