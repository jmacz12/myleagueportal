'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  LeagueSiteHeroEditOverlay,
  LeagueSiteLookControls,
  LeagueSiteSectionsEditor,
  LeagueSiteStickyEditBar,
} from '@/components/league-site/LeagueSiteOnPageEditor'
import {
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  Loader2,
  MapPin,
  Trophy,
  Users,
  ShieldHalf,
  BarChart3,
  Info,
} from 'lucide-react'
import NewsBanner from '@/components/NewsBanner'
import { MediaGalleryPublic } from '@/components/league-site/MediaGalleryPublic'
import { LeagueNotFoundOrganizerHint } from '@/components/LeagueNotFoundOrganizerHint'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import type { LeagueAppearanceMode } from '@/lib/leagueTheme'
import { contrastTextForAccent, publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import type { LeagueSitePayload, LeagueSiteSection } from '@/lib/league-site'
import { DEFAULT_LEAGUE_HERO_TAGLINE, EMPTY_LEAGUE_SITE, displayHeroInitials } from '@/lib/league-site'
import { subscribeLeagueAppearanceUpdated } from '@/lib/league-appearance-sync'
import { googleFontStylesheetHref, resolvePublicLeagueFontStack } from '@/lib/public-league-fonts'
import { StreamWithOverlay } from '@/components/public-stream/StreamWithOverlay'
import { createClient } from '@supabase/supabase-js'

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

function LeagueSiteSections({
  site,
  preset,
}: {
  site: LeagueSitePayload
  preset: ReturnType<typeof resolveThemePreset>
}) {
  if (!site.sections.length) return null
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 0 32px' }}>
      {site.sections.map((sec) => (
        <LeagueSiteSectionBlock key={sec.id} section={sec} preset={preset} />
      ))}
    </div>
  )
}

function LeagueSiteSectionBlock({
  section,
  preset,
}: {
  section: LeagueSiteSection
  preset: ReturnType<typeof resolveThemePreset>
}) {
  return (
    <section
      style={{
        marginBottom: '28px',
        padding: '0',
        borderRadius: '18px',
        background: preset.surfaceBg,
        border: `1px solid ${preset.surfaceBorder}`,
        boxShadow: '0 12px 40px -24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '4px',
          background: `linear-gradient(90deg, ${preset.accent} 0%, ${preset.accent} 35%, transparent 100%)`,
        }}
      />
      <div style={{ padding: '24px 24px 26px' }}>
      <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 900, color: preset.heading, margin: '0 0 16px', letterSpacing: '-0.02em' }}>{section.title}</h2>
      {section.type === 'media' ? (
        <MediaGalleryPublic items={section.items} preset={preset} />
      ) : (
        <div style={{ fontSize: '15px', color: preset.body, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{section.body}</div>
      )}
      </div>
    </section>
  )
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

function parseLeaguePublicTab(v: string | null): LeaguePublicTabId {
  if (v === 'stream' || v === 'news' || v === 'schedule' || v === 'standings' || v === 'teams' || v === 'about') return v
  return 'home'
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

function sortLeagueScheduleItems(items: LeagueScheduleItem[]): LeagueScheduleItem[] {
  return [...items].sort((a, b) => {
    const aTs = new Date(a.scheduled_at).getTime()
    const bTs = new Date(b.scheduled_at).getTime()
    const aPlaying = a.is_user_playing ? 1 : 0
    const bPlaying = b.is_user_playing ? 1 : 0
    if (aPlaying !== bPlaying) return bPlaying - aPlaying
    if (aPlaying === 1 && bPlaying === 1 && a.type !== b.type) {
      return a.type === 'season_game' ? -1 : 1
    }
    return aTs - bTs
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

function LeaguePublicTabBar({
  active,
  onChange,
  preset,
}: {
  active: LeaguePublicTabId
  onChange: (id: LeaguePublicTabId) => void
  preset: ReturnType<typeof resolveThemePreset>
}) {
  return (
    <nav
      aria-label="League sections"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 45,
        background: preset.pageBg,
        boxShadow: '0 8px 24px -18px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '0 8px 2px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '2px',
            rowGap: '0',
          }}
        >
        {LEAGUE_TAB_META.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                flex: '0 0 auto',
                padding: '14px 14px',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.02em',
                border: 'none',
                borderBottom: isActive ? `3px solid ${preset.accent}` : '3px solid transparent',
                background: 'transparent',
                color: isActive ? preset.heading : preset.muted,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
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

  const setLeagueTab = (next: LeaguePublicTabId) => {
    const paramsNext = new URLSearchParams(searchParams.toString())
    if (next === 'home') paramsNext.delete('tab')
    else paramsNext.set('tab', next)
    const q = paramsNext.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

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
  const [expandedScheduleCluster, setExpandedScheduleCluster] = useState<Record<string, boolean>>({})
  const [standingsRows, setStandingsRows] = useState<LeagueStandingRow[]>([])
  const [leadersRows, setLeadersRows] = useState<LeagueLeaderRow[]>([])
  const [streamLive, setStreamLive] = useState<{
    gameId: string
    streamPageUrl: string | null
    homeName: string | null
    awayName: string | null
  } | null>(null)
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      const [hubRes, teamsRes, sesRes, standingsRes, streamRes] = await Promise.all([
        fetch(`/api/join/${slug}/hub`),
        fetch(`/api/join/${slug}/teams`),
        fetch(`/api/join/${slug}/sessions`),
        fetch(`/api/join/${slug}/standings`),
        fetch(`/api/join/${slug}/stream`),
      ])
      if (cancelled) return
      if (hubRes.status === 404) {
        setNotFound(true)
        setHub(null)
        setTeams([])
        setScheduleItems([])
        setStandingsRows([])
        setLeadersRows([])
        setStreamLive(null)
        setLoading(false)
        return
      }
      const hubJson = await hubRes.json().catch(() => null)
      const teamsJson = await teamsRes.json().catch(() => ({}))
      const sesJson = await sesRes.json().catch(() => ({}))
      const standingsJson = await standingsRes.json().catch(() => ({}))
      const streamJson = await streamRes.json().catch(() => ({}))
      if (!hubJson?.organization) {
        setNotFound(true)
        setHub(null)
        setTeams([])
        setScheduleItems([])
        setStandingsRows([])
        setLeadersRows([])
        setStreamLive(null)
      } else {
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
        setStandingsRows(Array.isArray(standingsJson.standings) ? standingsJson.standings : [])
        setLeadersRows(Array.isArray(standingsJson.leaders) ? standingsJson.leaders : [])
        const live = streamJson?.live
        if (live && typeof live.gameId === 'string') {
          setStreamLive({
            gameId: live.gameId,
            streamPageUrl: typeof live.streamPageUrl === 'string' ? live.streamPageUrl : null,
            homeName: typeof live.homeName === 'string' ? live.homeName : null,
            awayName: typeof live.awayName === 'string' ? live.awayName : null,
          })
        } else {
          setStreamLive(null)
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const refreshStreamLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/join/${slug}/stream`)
      if (!res.ok) return
      const json = await res.json().catch(() => null)
      const live = json?.live
      if (live && typeof live.gameId === 'string') {
        setStreamLive({
          gameId: live.gameId,
          streamPageUrl: typeof live.streamPageUrl === 'string' ? live.streamPageUrl : null,
          homeName: typeof live.homeName === 'string' ? live.homeName : null,
          awayName: typeof live.awayName === 'string' ? live.awayName : null,
        })
      } else {
        setStreamLive(null)
      }
    } catch {
      /* ignore */
    }
  }, [slug])

  /** Live tab: refetch stream context when scoring updates games/stats (no polling). */
  useEffect(() => {
    const orgId = hub?.organization?.id
    if (!orgId) return
    let cancelled = false
    const channel = supabase
      .channel(`league-stream-org-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `organization_id=eq.${orgId}` },
        () => {
          if (!cancelled) void refreshStreamLive()
        }
      )
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [hub?.organization?.id, refreshStreamLive])

  /** Also listen on the active live game so stat taps (player_game_stats) refresh immediately. */
  useEffect(() => {
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
  }, [streamLive?.gameId, refreshStreamLive])

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

  const newsSections = useMemo(
    () => displaySite.sections.filter((s) => s.type === 'news'),
    [displaySite.sections]
  )
  const aboutSections = useMemo(
    () => displaySite.sections.filter((s) => s.type !== 'news'),
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

  const shellPreset = useMemo(() => resolveThemePreset('#5a7a2a', 'classic', 'light'), [])

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

  const heroTheme = useMemo(() => publicHeroThemeFromPreset(preset), [preset])

  const rankedScheduleItems = useMemo(() => sortLeagueScheduleItems(scheduleItems), [scheduleItems])
  const leagueScheduleDisplayRows = useMemo(
    () => buildLeagueScheduleDisplayRows(rankedScheduleItems),
    [rankedScheduleItems]
  )
  /** Home tab: next few schedule rows (same grouping as Schedule tab for recurring drop-ins). */
  const homeSchedulePreviewRows = useMemo(
    () => leagueScheduleDisplayRows.slice(0, 6),
    [leagueScheduleDisplayRows]
  )
  const latestNewsSection = newsSections[0] ?? null
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
            href={`/sign-in?redirect_url=${encodeURIComponent(`/league/${slug}?edit=1`)}`}
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
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/league/${slug}?edit=1`)}`} style={{ fontWeight: 800, color: preset.accent }}>
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
            doneHref={`/league/${slug}`}
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
          padding: '10px 16px',
          borderBottom: `1px solid ${heroTheme.stickyBorder}`,
          background: heroTheme.stickyBackground,
          backdropFilter: 'saturate(160%) blur(14px)',
          WebkitBackdropFilter: 'saturate(160%) blur(14px)',
          boxShadow: stickyVisible ? '0 8px 28px -18px rgba(0,0,0,0.35)' : 'none',
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
            maxWidth: '1000px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {publicBrandInputs.usePlatformBranding ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 900,
                letterSpacing: '0.06em',
                color: preset.heading,
                padding: '6px 10px',
                borderRadius: '8px',
                border: `1px solid ${preset.surfaceBorder}`,
                background: preset.surfaceBg,
                flexShrink: 0,
              }}
            >
              MLP
            </span>
          ) : org.logo_url ? (
            <img src={org.logo_url} alt="" style={{ height: '36px', width: '36px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
          ) : (
            <div
              style={{
                height: '36px',
                width: '36px',
                borderRadius: '10px',
                background: preset.accentSoftBg,
                border: `1px solid ${preset.surfaceBorder}`,
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: preset.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      <LeaguePublicTabBar active={activeTab} onChange={setLeagueTab} preset={preset} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 32px' }}>
        {activeTab === 'home' ? (
          <>
            <div
              style={{
                background: heroTheme.bandAltBg,
                borderTop: `1px solid ${preset.surfaceBorder}`,
                borderBottom: `1px solid ${preset.surfaceBorder}`,
                padding: '34px 0',
                margin: '0 -24px 28px',
                paddingLeft: '24px',
                paddingRight: '24px',
              }}
            >
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                  <LayoutGrid size={20} color={preset.accent} aria-hidden />
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: preset.muted }}>
                      Get on the floor
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>
                      Join this league
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                  {competitiveSeason && seasonRegistrationOpen ? (
                    <Link
                      href={`/join/${slug}/register`}
                      style={{
                        textDecoration: 'none',
                        background: preset.surfaceBg,
                        border: `1px solid ${preset.surfaceBorder}`,
                        borderRadius: '18px',
                        padding: '24px',
                        boxShadow: '0 14px 36px -22px rgba(0,0,0,0.35)',
                        color: 'inherit',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: preset.accentSoftBg, color: preset.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                      boxShadow: '0 14px 36px -22px rgba(0,0,0,0.35)',
                      color: 'inherit',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: preset.accentSoftBg, color: preset.heading, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  href={`/league/${slug}?tab=stream`}
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
                  <span style={{ fontSize: '13px', fontWeight: 800, color: preset.accent }}>Watch →</span>
                </Link>
              ) : null}

              <div
                style={{
                  background: preset.surfaceBg,
                  border: `1px solid ${preset.surfaceBorder}`,
                  borderRadius: '16px',
                  padding: '20px 20px 18px',
                  marginBottom: latestNewsSection ? '16px' : 0,
                  boxShadow: '0 10px 28px -20px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CalendarDays size={20} color={preset.accent} aria-hidden />
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: preset.muted }}>
                        Calendar
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '17px', fontWeight: 900, color: preset.heading, letterSpacing: '-0.02em' }}>
                        Up next
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/league/${slug}?tab=schedule`}
                    style={{ fontSize: '13px', fontWeight: 800, color: preset.accent, textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Full schedule
                  </Link>
                </div>
                {homeSchedulePreviewRows.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '14px', color: preset.muted, lineHeight: 1.55 }}>
                    No league games or open drop-ins on the calendar yet. Check back soon—or ask your organizer to post dates.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {homeSchedulePreviewRows.map((row, idx) => {
                      if (row.kind === 'single') {
                        const item = row.item
                        const local = formatDropInSessionLocal(item.scheduled_at, org.league_timezone)
                        const isDropin = item.type === 'drop_in'
                        const href = isDropin
                          ? `/join/${slug}/dropins`
                          : `/games/${item.source_id}/scoreboard`
                        const badgeBg = isDropin ? preset.accentSoftBg : '#f3e8ff'
                        const badgeColor = isDropin ? preset.accent : '#6d28d9'
                        const badgeLabel = isDropin ? 'Drop-in' : 'League game'
                        return (
                          <li
                            key={item.id}
                            style={{
                              borderTop: idx === 0 ? 'none' : `1px solid ${preset.surfaceBorder}`,
                              padding: '12px 0',
                            }}
                          >
                            <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    padding: '2px 7px',
                                    borderRadius: '999px',
                                    background: badgeBg,
                                    color: badgeColor,
                                    border: `1px solid ${preset.surfaceBorder}`,
                                  }}
                                >
                                  {badgeLabel}
                                </span>
                                {item.is_user_playing ? (
                                  <span style={{ fontSize: '10px', fontWeight: 800, color: preset.accent }}>You&apos;re in</span>
                                ) : null}
                              </div>
                              <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: preset.heading }}>{item.name}</p>
                              <p style={{ margin: 0, fontSize: '13px', color: preset.muted }}>
                                {local.day} · {local.time}
                                {local.zone ? ` ${local.zone}` : ''}
                              </p>
                              {item.location_label ? (
                                <p style={{ margin: '6px 0 0', fontSize: '12px', color: preset.body, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                  <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px', color: preset.accent }} aria-hidden />
                                  <span>{item.location_label}</span>
                                </p>
                              ) : null}
                              {isDropin ? (
                                <p style={{ margin: '8px 0 0', fontSize: '12px', color: preset.muted }}>{dropinSignupSummary(item)}</p>
                              ) : null}
                              <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px', fontWeight: 800, color: preset.accent }}>
                                {isDropin ? 'Reserve spot' : 'Scoreboard'} →
                              </span>
                            </Link>
                          </li>
                        )
                      }
                      const { base, items } = row
                      const next = items[0]!
                      const local = formatDropInSessionLocal(next.scheduled_at, org.league_timezone)
                      const moreCount = items.length - 1
                      const loc0 = next.location_label
                      return (
                        <li
                          key={`home-recur:${base}`}
                          style={{
                            borderTop: idx === 0 ? 'none' : `1px solid ${preset.surfaceBorder}`,
                            padding: '12px 0',
                          }}
                        >
                          <Link href={`/join/${slug}/dropins`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                  padding: '2px 7px',
                                  borderRadius: '999px',
                                  background: preset.accentSoftBg,
                                  color: preset.accent,
                                  border: `1px solid ${preset.surfaceBorder}`,
                                }}
                              >
                                Repeating drop-in
                              </span>
                              {items.some((i) => i.is_user_playing) ? (
                                <span style={{ fontSize: '10px', fontWeight: 800, color: preset.accent }}>You&apos;re in</span>
                              ) : null}
                            </div>
                            <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: preset.heading }}>{base}</p>
                            <p style={{ margin: 0, fontSize: '13px', color: preset.muted }}>
                              Next: {local.day} · {local.time}
                              {local.zone ? ` ${local.zone}` : ''}
                              {moreCount > 0 ? ` · +${moreCount} more date${moreCount === 1 ? '' : 's'}` : ''}
                            </p>
                            {loc0 ? (
                              <p style={{ margin: '6px 0 0', fontSize: '12px', color: preset.body, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px', color: preset.accent }} aria-hidden />
                                <span>{loc0}</span>
                              </p>
                            ) : null}
                            <p style={{ margin: '8px 0 0', fontSize: '12px', color: preset.muted }}>{dropinSignupSummary(next)}</p>
                            <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px', fontWeight: 800, color: preset.accent }}>
                              View drop-ins →
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {latestNewsSection && latestNewsSection.type === 'news' ? (
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
            <p style={{ margin: '0 0 22px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, width: '100%' }}>
              When a season game is marked live and a team has published a YouTube or Twitch link, you can watch here with the scoreboard on top. Use Full screen to expand video and overlay together.
            </p>
            {!streamLive ? (
              <div
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  background: preset.surfaceBg,
                  border: `1px solid ${preset.surfaceBorder}`,
                  borderRadius: '16px',
                  color: preset.body,
                  fontSize: '14px',
                  lineHeight: 1.55,
                }}
              >
                No game is live right now. Check the <strong style={{ color: preset.heading }}>Schedule</strong> tab, or open a team&apos;s{' '}
                <strong style={{ color: preset.heading }}>Stream</strong> tab if they&apos;ve posted a broadcast link.
              </div>
            ) : !streamLive.streamPageUrl?.trim() ? (
              <div
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  background: preset.surfaceBg,
                  border: `1px solid ${preset.surfaceBorder}`,
                  borderRadius: '16px',
                  color: preset.body,
                  fontSize: '14px',
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: preset.heading }}>
                  {streamLive.homeName || 'Home'} vs {streamLive.awayName || 'Away'}
                </strong>{' '}
                is live, but neither team has added a stream URL yet. Ask the home or away manager to add one under{' '}
                <strong style={{ color: preset.heading }}>Manage team → Page & links</strong>.
              </div>
            ) : (
              (() => {
                const raw = streamLive.streamPageUrl!.trim()
                let watchUrl: string | null = null
                try {
                  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
                  if (u.protocol === 'http:' || u.protocol === 'https:') watchUrl = u.href
                } catch {
                  watchUrl = null
                }
                return watchUrl ? (
                  <StreamWithOverlay watchUrl={watchUrl} liveGameId={streamLive.gameId} accentColor={preset.accent} />
                ) : (
                  <p style={{ color: preset.muted }}>Could not read stream URL.</p>
                )
              })()
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
                      item.type === 'drop_in' ? `/join/${slug}/dropins` : `/games/${item.source_id}/scoreboard`
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
                <p style={{ color: preset.heading, fontWeight: 800, margin: 0 }}>No upcoming schedule items</p>
                <p style={{ color: preset.muted, fontSize: '14px', margin: '8px 0 0' }}>Check back soon or ask your organizer for dates.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {leagueScheduleDisplayRows.map((row) => {
                  if (row.kind === 'single') {
                    const item = row.item
                    const local = formatDropInSessionLocal(item.scheduled_at, org.league_timezone)
                    const isDropin = item.type === 'drop_in'
                    const loc = item.location_label
                    const cardHref = isDropin ? `/join/${slug}/dropins` : `/games/${item.source_id}/scoreboard`
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
                          <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: preset.heading }}>{item.name || 'Schedule item'}</p>
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
            <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 900, color: preset.heading, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              League news
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '560px' }}>
              Weekly updates from organizers. Team pages also surface these league updates on their News tabs.
            </p>
            {newsSections.length > 0 ? (
              <LeagueSiteSections
                site={{ ...displaySite, sections: newsSections }}
                preset={preset}
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
                  Organizers can add a <strong style={{ color: preset.heading }}>News</strong> section from <strong style={{ color: preset.heading }}>Edit page</strong>.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'standings' ? (
          <div style={{ paddingTop: '24px' }}>
            {isProLike ? (
              <>
                <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 900, color: preset.heading, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  Standings & leaders
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '560px' }}>
                  When games are recorded, league standings and stat leaders can be highlighted here for fans and players.
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ background: preset.accentSoftBg, color: preset.body, textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', fontWeight: 800 }}>#</th>
                          <th style={{ padding: '10px 12px', fontWeight: 800 }}>Team</th>
                          <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>W</th>
                          <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>L</th>
                          <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>PCT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standingsRows.map((row, idx) => (
                          <tr key={row.team_id} style={{ borderTop: `1px solid ${preset.surfaceBorder}` }}>
                            <td style={{ padding: '10px 12px', color: preset.muted }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', color: preset.heading, fontWeight: 700 }}>{row.team_name}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body }}>{row.wins}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body }}>{row.losses}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: preset.body }}>{row.pct.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 900, color: preset.heading, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
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
                {hub.leagueSite.sections.filter((sec) => sec.type !== 'news').length > 0 ? (
                  <div style={{ marginTop: '18px', opacity: 0.85 }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: preset.muted, marginBottom: '12px' }}>
                      Published About content (read-only preview)
                    </p>
                    <LeagueSiteSections site={{ ...hub.leagueSite, sections: hub.leagueSite.sections.filter((sec) => sec.type !== 'news') }} preset={preset} />
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
              />
            ) : aboutSections.length > 0 ? (
              <LeagueSiteSections site={{ ...displaySite, sections: aboutSections }} preset={preset} />
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
          href={`/league/${slug}?edit=1`}
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
