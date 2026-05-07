'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CalendarDays, ChevronRight, House, Trophy } from 'lucide-react'
import { LeagueNotFoundOrganizerHint } from '@/components/LeagueNotFoundOrganizerHint'
import NewsBanner from '@/components/NewsBanner'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import { publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import type { LeagueSitePayload } from '@/lib/league-site'
import { DEFAULT_LEAGUE_HERO_TAGLINE, EMPTY_LEAGUE_SITE, displayHeroInitials } from '@/lib/league-site'
import { googleFontStylesheetHref, resolvePublicLeagueFontStack } from '@/lib/public-league-fonts'
import { effectiveSignupOpensAtIso } from '@/lib/seasonSignup'

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
  plan?: string | null
}

interface CompetitiveSeason {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  allow_online_registration?: boolean
  signup_opens_mode?: string | null
  signup_opens_days_before?: number | null
  online_registration_opens_at?: string | null
  online_registration_closes_at?: string | null
}

function seasonSignupClosedDetail(cs: CompetitiveSeason | null): string {
  if (!cs) return 'Visit the league home for teams and news, or ask when registration opens.'
  if (!cs.allow_online_registration) {
    return `Public registration is off for ${cs.name}. See league home or use drop-ins.`
  }
  const now = Date.now()
  const opensIso = effectiveSignupOpensAtIso(cs)
  if (opensIso && now < new Date(opensIso).getTime()) {
    return `Signups open ${new Date(opensIso).toLocaleString()}.`
  }
  if (cs.online_registration_closes_at && now > new Date(cs.online_registration_closes_at).getTime()) {
    return 'Online signups have closed. Try drop-ins or ask your league.'
  }
  return 'Use drop-ins or check back later.'
}

interface HubResponse {
  organization: HubOrg
  competitiveSeason: CompetitiveSeason | null
  signupSeasons?: CompetitiveSeason[]
  seasonRegistrationOpen: boolean
  leagueSite: LeagueSitePayload
}

export default function JoinHubPage() {
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hub, setHub] = useState<HubResponse | null>(null)
  const [dropInCount, setDropInCount] = useState(0)
  const [signedInOrg, setSignedInOrg] = useState<{ slug: string; name: string } | null>(null)
  const [accessResolved, setAccessResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      const [hubRes, sesRes] = await Promise.all([
        fetch(`/api/join/${slug}/hub`),
        fetch(`/api/join/${slug}/sessions`),
      ])
      if (cancelled) return
      if (hubRes.status === 404) {
        setNotFound(true)
        setHub(null)
        setLoading(false)
        return
      }
      const hubJson = await hubRes.json().catch(() => null)
      const sesJson = await sesRes.json().catch(() => ({}))
      if (!hubJson?.organization) {
        setNotFound(true)
        setHub(null)
      } else {
        setHub({
          organization: hubJson.organization,
          competitiveSeason: hubJson.competitiveSeason ?? null,
          seasonRegistrationOpen: !!hubJson.seasonRegistrationOpen,
          leagueSite: hubJson.leagueSite ?? EMPTY_LEAGUE_SITE,
        })
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
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) {
          setSignedInOrg(null)
          return
        }
        const d = await r.json()
        if (cancelled) return
        const a = d.access
        if (a?.slug && a?.name) setSignedInOrg({ slug: String(a.slug), name: String(a.name) })
        else setSignedInOrg(null)
      })
      .catch(() => {
        if (!cancelled) setSignedInOrg(null)
      })
      .finally(() => {
        if (!cancelled) setAccessResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const leagueSiteForFont = hub?.leagueSite ?? EMPTY_LEAGUE_SITE
  const publicFontStack = useMemo(
    () => resolvePublicLeagueFontStack(leagueSiteForFont.publicFontKey),
    [leagueSiteForFont.publicFontKey]
  )

  useEffect(() => {
    const href = googleFontStylesheetHref(leagueSiteForFont.publicFontKey)
    if (!href) return
    const key = leagueSiteForFont.publicFontKey || 'plus-jakarta'
    const id = `public-league-font-${key}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [leagueSiteForFont.publicFontKey])

  const shellPreset = resolveThemePreset(null, null, 'light')

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm font-semibold"
        style={{
          fontFamily: publicFontStack,
          background: shellPreset.pageBg,
          color: shellPreset.heading,
        }}
      >
        Loading…
      </div>
    )
  }

  if (notFound || !hub) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ fontFamily: publicFontStack, background: shellPreset.pageBg }}
      >
        <p style={{ color: shellPreset.heading, fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          League not found
        </p>
        <p style={{ color: shellPreset.muted, fontSize: '14px', maxWidth: '360px' }}>
          {accessResolved && !signedInOrg
            ? 'Check the link or ask your organizer for the correct URL. Organizers: use the address from Dashboard → Settings.'
            : 'Check the link or ask your organizer for the correct registration URL.'}
        </p>
        <LeagueNotFoundOrganizerHint signedInOrg={signedInOrg} currentSlug={slug} preset={shellPreset} variant="join" />
      </div>
    )
  }

  const { organization: org, competitiveSeason, seasonRegistrationOpen, leagueSite } = hub
  const signupSeasons = hub.signupSeasons || []
  const brandIn = getPublicThemeInputsForOrg(org)
  const preset = resolveThemePreset(brandIn.primaryColor, brandIn.presetId, brandIn.appearanceMode)
  const accent = preset.accent
  const heroTheme = publicHeroThemeFromPreset(preset)

  return (
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: publicFontStack }}>
      <NewsBanner message={org.news_banner} color={org.news_banner_color} />

      <div style={{ position: 'relative' }}>
        <PublicLeagueHeroBand
          orgName={org.name}
          logoUrl={brandIn.usePlatformBranding ? null : org.logo_url}
          heroBackgroundUrl={brandIn.suppressCustomHero ? null : leagueSite.heroBackgroundUrl}
          tagline={leagueSite.heroTagline ?? DEFAULT_LEAGUE_HERO_TAGLINE}
          placeholderInitials={displayHeroInitials(leagueSite.heroInitials, org.name)}
          preset={preset}
          heroTheme={heroTheme}
          usePlatformBranding={brandIn.usePlatformBranding}
          compact
        />
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '28px 20px 56px' }}>
        <p
          style={{
            textAlign: 'center',
            color: preset.muted,
            fontSize: '14px',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          Sign up for the season or book a drop-in. Rosters and news live on the league home.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Link
            href={`/league/${slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: preset.surfaceBg,
              border: `1px solid ${preset.surfaceBorder}`,
              borderRadius: '16px',
              padding: '20px 20px',
              textDecoration: 'none',
              color: 'inherit',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: preset.accentSoftBg,
                color: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <House size={24} strokeWidth={1.5} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: preset.heading, marginBottom: '4px' }}>
                League home
              </div>
              <div style={{ fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                Teams, rosters, and news
              </div>
            </div>
            <ChevronRight size={22} color={preset.muted} style={{ flexShrink: 0 }} aria-hidden />
          </Link>

          {competitiveSeason && seasonRegistrationOpen ? (
            <Link
              href={`/join/${slug}/register`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: preset.surfaceBg,
                border: `1px solid ${preset.surfaceBorder}`,
                borderRadius: '16px',
                padding: '20px 20px',
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.15s',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: preset.accentSoftBg,
                  color: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trophy size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: preset.heading, marginBottom: '4px' }}>
                  Join the season
                </div>
                <div style={{ fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                  {signupSeasons.length > 1
                    ? `${signupSeasons.length} seasons open — choose one`
                    : competitiveSeason.name}
                </div>
              </div>
              <ChevronRight size={22} color={preset.muted} style={{ flexShrink: 0 }} aria-hidden />
            </Link>
          ) : competitiveSeason && !seasonRegistrationOpen ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: preset.accentSoftBg,
                border: `1px dashed ${preset.surfaceBorder}`,
                borderRadius: '16px',
                padding: '20px',
                opacity: 0.95,
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: preset.surfaceBg,
                  color: preset.muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trophy size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: preset.body, marginBottom: '4px' }}>
                  Season signup not online
                </div>
                <div style={{ fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                  {seasonSignupClosedDetail(competitiveSeason)}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: preset.accentSoftBg,
                border: `1px dashed ${preset.surfaceBorder}`,
                borderRadius: '16px',
                padding: '20px',
                opacity: 0.95,
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: preset.surfaceBg,
                  color: preset.muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trophy size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: preset.body, marginBottom: '4px' }}>
                  No season signup open
                </div>
                <div style={{ fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                  Visit league home for teams and news, or try drop-ins below.
                </div>
              </div>
            </div>
          )}

          <Link
            href={`/join/${slug}/dropins`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: preset.surfaceBg,
              border: `1px solid ${preset.surfaceBorder}`,
              borderRadius: '16px',
              padding: '20px 20px',
              textDecoration: 'none',
              color: 'inherit',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: preset.accentSoftBg,
                color: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarDays size={24} strokeWidth={1.5} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: preset.heading, marginBottom: '4px' }}>
                Drop-in sessions
              </div>
              <div style={{ fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                {dropInCount === 0
                  ? 'No upcoming sessions right now'
                  : `${dropInCount} upcoming session${dropInCount === 1 ? '' : 's'} available`}
              </div>
            </div>
            <ChevronRight size={22} color={preset.muted} style={{ flexShrink: 0 }} aria-hidden />
          </Link>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: preset.muted,
            marginTop: '28px',
            lineHeight: 1.5,
          }}
        >
          Questions? Contact your league organizer.
        </p>
      </div>
    </div>
  )
}
