'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  LeagueSiteHeroEditOverlay,
  LeagueSiteSectionsEditor,
  LeagueSiteStickyEditBar,
} from '@/components/league-site/LeagueSiteOnPageEditor'
import { CalendarDays, ChevronRight, LayoutGrid, Loader2, Trophy, Users, ShieldHalf } from 'lucide-react'
import NewsBanner from '@/components/NewsBanner'
import { MediaGalleryPublic } from '@/components/league-site/MediaGalleryPublic'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import { contrastTextForAccent, publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import type { LeagueSitePayload, LeagueSiteSection } from '@/lib/league-site'
import { DEFAULT_LEAGUE_HERO_TAGLINE, EMPTY_LEAGUE_SITE, displayHeroInitials } from '@/lib/league-site'

interface HubOrg {
  id: string
  name: string
  slug: string
  primary_color: string | null
  logo_url: string | null
  news_banner: string | null
  news_banner_color: string | null
  league_theme_preset?: string | null
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
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 32px' }}>
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

function LeagueHomeContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hub, setHub] = useState<HubResponse | null>(null)
  const [teams, setTeams] = useState<PublicTeamRow[]>([])
  const [dropInCount, setDropInCount] = useState(0)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [canManageSite, setCanManageSite] = useState(false)
  const [accessResolved, setAccessResolved] = useState(false)
  const [draftSite, setDraftSite] = useState<LeagueSitePayload | null>(null)
  const [draftGalleryLimit, setDraftGalleryLimit] = useState(100)
  const [draftLoadState, setDraftLoadState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editorMessage, setEditorMessage] = useState('')
  const [editorError, setEditorError] = useState('')

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
        setDropInCount(Array.isArray(sesJson.sessions) ? sesJson.sessions.length : 0)
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
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const a = d.access
        setCanManageSite(!!a && a.slug === slug)
      })
      .catch(() => {
        if (!cancelled) setCanManageSite(false)
      })
      .finally(() => {
        if (!cancelled) setAccessResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const editMode = searchParams.get('edit') === '1' && canManageSite

  useEffect(() => {
    if (!editMode) {
      setDraftSite(null)
      setDraftLoadState('idle')
      setEditorMessage('')
      setEditorError('')
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

  const accent = hub?.organization.primary_color || '#5a7a2a'
  const preset = resolveThemePreset(hub?.organization.primary_color, hub?.organization.league_theme_preset)
  const heroTheme = useMemo(() => publicHeroThemeFromPreset(preset), [preset])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm font-semibold"
        style={{ background: preset.pageBg, color: preset.heading, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        Loading…
      </div>
    )
  }

  if (notFound || !hub) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        <p style={{ color: preset.heading, fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          League not found
        </p>
        <p style={{ color: preset.muted, fontSize: '14px', maxWidth: '360px' }}>
          Check the link or ask your organizer for the correct URL.
        </p>
      </div>
    )
  }

  const { organization: org, competitiveSeason, seasonRegistrationOpen } = hub
  const displaySite = editMode && draftSite ? draftSite : hub.leagueSite
  const seasonDates = competitiveSeason ? formatSeasonDates(competitiveSeason) : null
  const registrationStatusLabel = seasonRegistrationOpen ? 'Registration Open' : 'Registration Closed'
  const totalPlayers = teams.reduce((sum, t) => sum + t.player_count, 0)

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
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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

      {editMode && draftLoadState === 'ok' && draftSite ? (
        <LeagueSiteStickyEditBar
          preset={preset}
          saving={saving}
          publishing={publishing}
          onSaveDraft={saveDraftOnPage}
          onPublish={publishOnPage}
          doneHref={`/league/${slug}`}
          statusMessage={editorMessage}
          errorMessage={editorError}
        />
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
          {org.logo_url ? (
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
          logoUrl={org.logo_url}
          heroBackgroundUrl={displaySite.heroBackgroundUrl}
          tagline={displaySite.heroTagline ?? DEFAULT_LEAGUE_HERO_TAGLINE}
          placeholderInitials={displayHeroInitials(displaySite.heroInitials, org.name)}
          preset={preset}
          heroTheme={heroTheme}
          showStats
          teamsCount={teams.length}
          playersCount={totalPlayers}
          showSeasonPill={!!competitiveSeason}
        />
        {editMode && draftSite ? (
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

      <div
        style={{
          background: heroTheme.bandAltBg,
          borderTop: `1px solid ${preset.surfaceBorder}`,
          borderBottom: `1px solid ${preset.surfaceBorder}`,
          padding: '34px 24px',
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
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
                  {dropInCount} upcoming session{dropInCount === 1 ? '' : 's'}
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

      <div style={{ paddingTop: displaySite.sections.length ? '28px' : 0 }}>
        {editMode && draftSite ? (
          <LeagueSiteSectionsEditor
            value={draftSite}
            onChange={setDraftSite}
            preset={preset}
            maxGalleryImages={draftGalleryLimit}
          />
        ) : (
          <LeagueSiteSections site={displaySite} preset={preset} />
        )}
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '34px 24px 0' }}>
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
