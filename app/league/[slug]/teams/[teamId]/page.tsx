'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, Settings2, Trophy } from 'lucide-react'
import { LeagueTeamManagePanel } from '@/components/league-team-manage-panel'
import { PRESET_PORTAL_ORIGINAL_ID, publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import { googleFontStylesheetHref, resolvePortalOriginalHeadingFontStack, resolvePublicLeagueFontStack } from '@/lib/public-league-fonts'
import { PublicTeamTabPanels } from './public-team-tab-panels'
import type { PublicTeamTab, TeamPayload } from './team-page-types'

export default function LeaguePublicTeamPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const teamId = params.teamId as string
  const tabFromUrl = searchParams.get('tab')
  const manageFromUrl = searchParams.get('manage')

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null)
  const [data, setData] = useState<TeamPayload | null>(null)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [publicTab, setPublicTab] = useState<PublicTeamTab>('overview')

  const refreshPayload = useCallback(async () => {
    if (!slug || !teamId) return
    try {
      const res = await fetch(
        `/api/join/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}`
      )
      const json = await res.json().catch(() => null)
      if (res.ok && json?.team && json?.organization) {
        setData(json as TeamPayload)
      }
    } catch {
      /* keep existing data */
    }
  }, [slug, teamId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!slug || !teamId) {
        setNotFound(true)
        setData(null)
        setLoadErrorDetail('This team link is missing a league or team id.')
        setLoading(false)
        return
      }

      setLoading(true)
      setNotFound(false)
      setLoadErrorDetail(null)

      const controller = new AbortController()
      const timeoutMs = 25000
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

      try {
        const res = await fetch(
          `/api/join/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}`,
          { signal: controller.signal }
        )
        if (cancelled) return
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.team || !json?.organization) {
          setNotFound(true)
          setData(null)
          const hint =
            typeof json?.error === 'string'
              ? json.error
              : !res.ok
                ? `Could not load team (${res.status}).`
                : null
          setLoadErrorDetail(hint)
        } else {
          setData(json as TeamPayload)
        }
      } catch (err) {
        if (cancelled) return
        setNotFound(true)
        setData(null)
        const aborted =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        setLoadErrorDetail(
          aborted
            ? `Request timed out after ${timeoutMs / 1000}s. Is the dev server running on this origin, and is Supabase reachable?`
            : 'Could not load this page. Check your network or try again.'
        )
      } finally {
        window.clearTimeout(timeoutId)
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug, teamId])

  useEffect(() => {
    setManageOpen(manageFromUrl === '1')
  }, [manageFromUrl])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/teams/${teamId}/manage-access`)
      if (cancelled) return
      if (!res.ok) {
        setIsStaff(false)
        return
      }
      const json = await res.json().catch(() => ({}))
      setIsStaff(json?.canManage === true)
    })()
    return () => {
      cancelled = true
    }
  }, [teamId])

  function openManage() {
    setManageOpen(true)
    const u = new URL(window.location.href)
    u.searchParams.set('manage', '1')
    router.replace(`${u.pathname}?${u.searchParams.toString()}`, { scroll: false })
  }

  function closeManage() {
    setManageOpen(false)
    const u = new URL(window.location.href)
    u.searchParams.delete('manage')
    const next = u.searchParams.toString()
    router.replace(next ? `${u.pathname}?${next}` : u.pathname, { scroll: false })
  }

  useEffect(() => {
    const allowed: PublicTeamTab[] = ['overview', 'stream', 'news', 'schedule', 'roster', 'stats']
    if (tabFromUrl && allowed.includes(tabFromUrl as PublicTeamTab)) setPublicTab(tabFromUrl as PublicTeamTab)
    else setPublicTab('overview')
  }, [tabFromUrl])

  function setPublicTabQuery(next: PublicTeamTab) {
    setPublicTab(next)
    const u = new URL(window.location.href)
    if (next === 'overview') u.searchParams.delete('tab')
    else u.searchParams.set('tab', next)
    const qs = u.searchParams.toString()
    router.replace(qs ? `${u.pathname}?${qs}` : u.pathname, { scroll: false })
  }

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 72)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const preset = useMemo(() => {
    if (!data?.organization) return resolveThemePreset('#5a7a2a', 'classic', 'light')
    const b = getPublicThemeInputsForOrg(data.organization)
    return resolveThemePreset(b.primaryColor, b.presetId, b.appearanceMode)
  }, [data])

  const publicBrandInputs = useMemo(
    () => (data?.organization ? getPublicThemeInputsForOrg(data.organization) : null),
    [data?.organization]
  )
  const displayLogoUrl =
    publicBrandInputs?.usePlatformBranding ? null : data?.organization.logo_url ?? null

  const tier = data?.public_tier ?? 'basic'
  const proLike = tier === 'pro' || tier === 'enterprise'
  const heroLogoSrc =
    proLike && data?.team.logo_url ? data.team.logo_url : displayLogoUrl

  const publicFontStack = useMemo(
    () => resolvePublicLeagueFontStack(data?.publicFontKey),
    [data?.publicFontKey]
  )

  const portalOriginalLayout = preset.id === PRESET_PORTAL_ORIGINAL_ID
  const teamContentMax = portalOriginalLayout ? 'min(1040px, 100%)' : '920px'
  const publicHeadingFontStack = useMemo(
    () =>
      portalOriginalLayout
        ? resolvePortalOriginalHeadingFontStack(data?.publicFontKey)
        : publicFontStack,
    [portalOriginalLayout, data?.publicFontKey, publicFontStack]
  )

  useEffect(() => {
    const href = googleFontStylesheetHref(data?.publicFontKey)
    if (!href) return
    const key = data?.publicFontKey || 'plus-jakarta'
    const id = `public-league-font-${key}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [data?.publicFontKey])

  const heroTheme = useMemo(() => publicHeroThemeFromPreset(preset), [preset])
  const nextGameMapsHref = useMemo(() => {
    if (!data?.next_game?.location) return null
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.next_game.location)}`
  }, [data?.next_game?.location])

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-sm font-semibold"
        style={{ background: preset.pageBg, color: preset.heading, fontFamily: publicFontStack }}
      >
        <span>Loading…</span>
        {slug ? (
          <Link
            href={`/league/${slug}`}
            style={{ color: preset.accent, fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}
          >
            ← Back to league home
          </Link>
        ) : (
          <Link href="/" style={{ color: preset.accent, fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
            ← Home
          </Link>
        )}
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: preset.pageBg, fontFamily: publicFontStack }}
      >
        <p style={{ color: preset.heading, fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          Team not found
        </p>
        {loadErrorDetail ? (
          <p style={{ color: preset.muted, fontSize: '14px', maxWidth: '360px', marginBottom: '16px' }}>
            {loadErrorDetail}
          </p>
        ) : null}
        <Link
          href={`/league/${slug}`}
          style={{ color: preset.accent, fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}
        >
          ← Back to league home
        </Link>
      </div>
    )
  }

  const { organization: org, team, roster, season_record, league_rank, league_team_count, last_game, next_game } = data
  const teamStripe = team.color || preset.accent

  let watchHref: string | null = null
  if (team.stream_url?.trim()) {
    const raw = team.stream_url.trim()
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      if (u.protocol === 'http:' || u.protocol === 'https:') watchHref = u.href
    } catch {
      watchHref = null
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: publicFontStack }}>
      <div style={{ height: '6px', width: '100%', background: teamStripe }} aria-hidden />
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
        <div style={{ width: '100%', maxWidth: teamContentMax, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href={`/league/${slug}`}
            style={{ color: preset.heading, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            aria-label="Back to league home"
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
          {heroLogoSrc ? (
            <img src={heroLogoSrc} alt="" style={{ height: '32px', width: '32px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          ) : (
            <div
              style={{
                height: '32px',
                width: '32px',
                borderRadius: '8px',
                background: preset.accentSoftBg,
                border: `1px solid ${preset.surfaceBorder}`,
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <Link
                href={`/league/${slug}`}
                style={{ fontSize: '11px', fontWeight: 700, color: preset.muted, textDecoration: 'none' }}
              >
                Leagues
              </Link>
              <span style={{ fontSize: '10px', color: preset.muted }}>›</span>
              <Link
                href={`/league/${slug}`}
                style={{ fontSize: '11px', fontWeight: 700, color: preset.muted, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {org.name}
              </Link>
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: preset.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {org.name}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: preset.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {team.name}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: heroTheme.heroGradient,
          borderBottom: portalOriginalLayout ? `6px double ${teamStripe}` : `4px solid ${teamStripe}`,
          padding: portalOriginalLayout ? '32px 22px 36px' : '28px 20px 32px',
        }}
      >
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: heroTheme.heroGlow }} />
        <div style={{ position: 'relative', maxWidth: teamContentMax, margin: '0 auto' }}>
          <Link
            href={`/league/${slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: heroTheme.heroSubtitle,
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: '16px',
            }}
          >
            <ChevronLeft size={18} aria-hidden />
            League home
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              {heroLogoSrc ? (
                <img
                  src={heroLogoSrc}
                  alt={org.name}
                  style={{
                    height: '56px',
                    width: '56px',
                    objectFit: 'cover',
                    borderRadius: '14px',
                    border: `2px solid ${heroTheme.heroPlaceholderBorder}`,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '56px',
                    width: '56px',
                    borderRadius: '14px',
                    background: heroTheme.heroPlaceholderBg,
                    border: `2px solid ${heroTheme.heroPlaceholderBorder}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ color: heroTheme.heroSubtitle, fontSize: '12px', margin: 0, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {org.name}
                </p>
                <h1
                  style={{
                    fontFamily: portalOriginalLayout
                      ? 'Georgia, "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif'
                      : undefined,
                    fontStyle: portalOriginalLayout ? 'italic' : undefined,
                    fontSize: 'clamp(24px, 5vw, 32px)',
                    fontWeight: 800,
                    color: heroTheme.heroTitle,
                    margin: '4px 0 0',
                    letterSpacing: portalOriginalLayout ? '-0.01em' : '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {team.name}
                </h1>
              </div>
            </div>
            {isStaff ? (
              <button
                type="button"
                onClick={() => (manageOpen ? closeManage() : openManage())}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexShrink: 0,
                  padding: '9px 14px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: manageOpen ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
                  color: heroTheme.heroTitle,
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Settings2 size={16} aria-hidden />
                {manageOpen ? 'Close manage' : 'Manage team'}
              </button>
            ) : null}
          </div>
          <p style={{ color: heroTheme.heroSubtitle, fontSize: '14px', margin: '14px 0 0', lineHeight: 1.45 }}>{team.season_name}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: heroTheme.heroTitle,
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '999px',
                padding: '5px 10px',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              {roster.length} Player{roster.length === 1 ? '' : 's'}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: heroTheme.heroTitle,
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '999px',
                padding: '5px 10px',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              Public Roster
            </span>
            {proLike && season_record ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: heroTheme.heroTitle,
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '5px 10px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Trophy size={12} aria-hidden />
                {season_record.wins}-{season_record.losses}
              </span>
            ) : null}
            {proLike && league_rank != null && (league_team_count ?? 0) > 1 ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: heroTheme.heroTitle,
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '5px 10px',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                Rank #{league_rank} / {league_team_count}
              </span>
            ) : null}
          </div>
          {proLike && (last_game || next_game) ? (
            <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '520px' }}>
              {last_game ? (
                <Link
                  href={`/league/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}?tab=stream`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'rgba(255,255,255,0.08)',
                    color: heroTheme.heroTitle,
                    boxShadow: '0 12px 32px -22px rgba(0,0,0,0.35)',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: 900,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: heroTheme.heroSubtitle,
                      marginBottom: '6px',
                    }}
                  >
                    Last result
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                    <span style={{ color: last_game.won ? '#86efac' : '#fca5a5' }}>{last_game.won ? 'W' : 'L'}</span>{' '}
                    {last_game.team_points}–{last_game.opp_points}{' '}
                    <span style={{ color: heroTheme.heroSubtitle, fontWeight: 700 }}>vs {last_game.opponent_name}</span>
                  </span>
                  {last_game.scheduled_at ? (
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', fontWeight: 600, color: heroTheme.heroSubtitle }}>
                      {new Date(last_game.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  ) : null}
                  <span style={{ display: 'block', marginTop: '10px', fontSize: '12px', fontWeight: 800, color: heroTheme.heroTitle, opacity: 0.95 }}>
                    Stream tab · box score →
                  </span>
                </Link>
              ) : null}
              {next_game ? (
                <Link
                  href={`/league/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}?tab=schedule`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    color: heroTheme.heroTitle,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '10px',
                      fontWeight: 900,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: heroTheme.heroSubtitle,
                      marginBottom: '6px',
                    }}
                  >
                    <CalendarDays size={14} aria-hidden style={{ opacity: 0.9 }} />
                    Next game
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                    {team.name} <span style={{ color: heroTheme.heroSubtitle, fontWeight: 700 }}>vs</span> {next_game.opponent_name}
                  </span>
                  {next_game.scheduled_at ? (
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '13px', fontWeight: 600, color: heroTheme.heroSubtitle }}>
                      {new Date(next_game.scheduled_at).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  ) : null}
                  {next_game.location ? (
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: heroTheme.heroSubtitle, lineHeight: 1.4 }}>
                      {next_game.location}
                    </span>
                  ) : null}
                  <span style={{ display: 'block', marginTop: '10px', fontSize: '12px', fontWeight: 800, color: heroTheme.heroTitle, opacity: 0.95 }}>
                    Schedule tab →
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ maxWidth: teamContentMax, margin: '0 auto', padding: '20px 20px 56px' }}>
        {manageOpen && isStaff ? (
          <div style={{ marginBottom: '20px' }}>
            <LeagueTeamManagePanel
              teamId={teamId}
              orgSlug={slug}
              variant="public"
              onClose={closeManage}
              onDataChanged={() => void refreshPayload()}
            />
          </div>
        ) : null}
        <PublicTeamTabPanels
          data={data}
          slug={slug}
          preset={preset}
          publicTab={publicTab}
          setPublicTabQuery={setPublicTabQuery}
          watchHref={watchHref}
          liveGameId={data.live_game_id ?? null}
          nextGameMapsHref={nextGameMapsHref}
          onJerseyPreferenceSaved={() => void refreshPayload()}
          portalOriginalLayout={portalOriginalLayout}
          headingFontFamily={portalOriginalLayout ? publicHeadingFontStack : undefined}
        />
      </div>

      <div
        style={{
          marginTop: '32px',
          padding: '24px 20px 32px',
          background: heroTheme.footerBarBg,
          borderTop: `1px solid ${preset.surfaceBorder}`,
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: heroTheme.footerBarText,
            margin: 0,
            lineHeight: 1.5,
            maxWidth: '420px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Questions? Contact your league organizer.
        </p>
      </div>
    </div>
  )
}
