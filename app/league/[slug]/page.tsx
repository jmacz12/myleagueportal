'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
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
import { googleFontStylesheetHref, resolvePublicLeagueFontStack } from '@/lib/public-league-fonts'

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
  season_id: string | null
  season_name: string
  player_count: number
  open_jersey_poll_id: string | null
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

type LeaguePublicTabId = 'home' | 'schedule' | 'standings' | 'teams' | 'about'

const LEAGUE_TAB_META: { id: LeaguePublicTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'standings', label: 'Standings' },
  { id: 'teams', label: 'Teams' },
  { id: 'about', label: 'About' },
]

function parseLeaguePublicTab(v: string | null): LeaguePublicTabId {
  if (v === 'schedule' || v === 'standings' || v === 'teams' || v === 'about') return v
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
    { id: string; name?: string; scheduled_at: string; fee_amount?: number; max_players?: number; signups?: unknown[] }[]
  >([])
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
      const [hubRes, teamsRes, sesRes] = await Promise.all([
        fetch(`/api/join/${slug}/hub`),
        fetch(`/api/join/${slug}/teams`),
        fetch(`/api/join/${slug}/sessions`),
      ])
      if (cancelled) return
      if (hubRes.status === 404) {
        setNotFound(true)
        setHub(null)
        setTeams([])
        setLoading(false)
        return
      }
      const hubJson = await hubRes.json().catch(() => null)
      const teamsJson = await teamsRes.json().catch(() => ({}))
      const sesJson = await sesRes.json().catch(() => ({}))
      if (!hubJson?.organization) {
        setNotFound(true)
        setHub(null)
        setTeams([])
      } else {
        setHub({
          organization: hubJson.organization,
          competitiveSeason: hubJson.competitiveSeason ?? null,
          seasonRegistrationOpen: !!hubJson.seasonRegistrationOpen,
          leagueSite: hubJson.leagueSite ?? EMPTY_LEAGUE_SITE,
        })
        setTeams(Array.isArray(teamsJson.teams) ? teamsJson.teams : [])
        setSessions(Array.isArray(sesJson.sessions) ? sesJson.sessions : [])
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    setAccessResolved(false)
    fetch('/api/me/org-access')
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
    let cancelled = false
    setDraftLoadState('loading')
    fetch('/api/league-site')
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
  }, [editMode])

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
        body: JSON.stringify({ draft: draftSite }),
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
        body: JSON.stringify({ draft: draftSite, publish: true }),
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
          <LeagueSiteLookControls
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
            }}
            orgAppearanceMode={org.league_appearance_mode}
            onPreviewChange={isProLike && siteAccessRole === 'owner' ? setAppearancePreview : undefined}
            websiteLockedForPlan={websiteLockedForPlan}
            appearanceMeta={appearanceApi ?? undefined}
          />
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
                          {sessions.length} upcoming session{sessions.length === 1 ? '' : 's'}
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
                  Stories, photos, and long-form updates from your organizer live on the <strong style={{ color: preset.heading }}>About</strong> tab.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: preset.body, lineHeight: 1.6, margin: 0 }}>
                No active season is published yet. When your organizer opens registration, you&apos;ll see season status and signup options here.
              </p>
            )}
          </>
        ) : null}

        {activeTab === 'schedule' ? (
          <div style={{ paddingTop: '24px' }}>
            <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 900, color: preset.heading, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Schedule & venues
            </h2>
            <p style={{ margin: '0 0 22px', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '560px' }}>
              Upcoming drop-in sessions for this league. Competitive game fixtures will appear here when your organizer connects the schedule to this page.
            </p>

            {sessions.length === 0 ? (
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
                <p style={{ color: preset.heading, fontWeight: 800, margin: 0 }}>No upcoming drop-ins</p>
                <p style={{ color: preset.muted, fontSize: '14px', margin: '8px 0 0' }}>Check back soon or ask your organizer for dates.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {sessions.map((s) => {
                  const local = formatDropInSessionLocal(s.scheduled_at, org.league_timezone)
                  const loc = (s as { location_label?: string; venue_name?: string }).location_label || (s as { venue_name?: string }).venue_name
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: preset.surfaceBg,
                        border: `1px solid ${preset.surfaceBorder}`,
                        borderRadius: '14px',
                        padding: '18px 20px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '14px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: preset.heading }}>{s.name || 'Drop-in session'}</p>
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
                        {typeof s.fee_amount === 'number' ? (
                          <p style={{ margin: '10px 0 0', fontSize: '14px', fontWeight: 800, color: preset.accent }}>${s.fee_amount}</p>
                        ) : null}
                      </div>
                      <Link
                        href={`/join/${slug}/dropins`}
                        style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          textDecoration: 'none',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          background: preset.accent,
                          color: contrastTextForAccent(preset.accent),
                          flexShrink: 0,
                        }}
                      >
                        Reserve
                      </Link>
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
                          background: `linear-gradient(100deg, ${teamAccent}14 0%, ${preset.surfaceBg} 48%)`,
                          border: `1px solid ${preset.surfaceBorder}`,
                          borderRadius: '16px',
                          padding: '16px 16px 16px 14px',
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
                              background: teamAccent,
                              color: contrastTextForAccent(teamAccent),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '15px',
                              fontWeight: 900,
                            }}
                            aria-hidden
                          >
                            {t.name.trim().charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: preset.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: '12px', color: preset.muted, fontWeight: 600 }}>
                              {t.player_count} player{t.player_count === 1 ? '' : 's'} · {t.season_name || 'Season'}
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
          <div style={{ paddingTop: displaySite.sections.length || editMode ? '28px' : '24px' }}>
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
                {hub.leagueSite.sections.length > 0 ? (
                  <div style={{ marginTop: '18px', opacity: 0.85 }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: preset.muted, marginBottom: '12px' }}>
                      Published content (read-only preview)
                    </p>
                    <LeagueSiteSections site={hub.leagueSite} preset={preset} />
                  </div>
                ) : null}
              </div>
            ) : editMode && draftSite && !websiteLockedForPlan ? (
              <LeagueSiteSectionsEditor
                value={draftSite}
                onChange={setDraftSite}
                preset={preset}
                maxGalleryImages={draftGalleryLimit}
              />
            ) : displaySite.sections.length > 0 ? (
              <LeagueSiteSections site={displaySite} preset={preset} />
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
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: preset.heading }}>No published sections yet</p>
                <p style={{ margin: '10px 0 0', fontSize: '14px', color: preset.muted, lineHeight: 1.55, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                  When your organizer adds text, news, or photo galleries in the league website editor, they&apos;ll show here — not on the Home tab — so this page stays easy to scan.
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
