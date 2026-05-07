'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { LeagueNotFoundOrganizerHint } from '@/components/LeagueNotFoundOrganizerHint'
import NewsBanner from '@/components/NewsBanner'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import RegistrationForm from '../RegistrationForm'
import { publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import type { LeagueSitePayload } from '@/lib/league-site'
import { DEFAULT_LEAGUE_HERO_TAGLINE, EMPTY_LEAGUE_SITE, displayHeroInitials } from '@/lib/league-site'
import { effectiveSignupOpensAtIso } from '@/lib/seasonSignup'

interface HubPayload {
  organization: {
    id: string
    name: string
    primary_color: string | null
    logo_url: string | null
    news_banner: string | null
    news_banner_color: string | null
    league_theme_preset?: string | null
    league_appearance_mode?: string | null
    plan?: string | null
  }
  competitiveSeason: {
    id: string
    name: string
    start_date?: string | null
    allow_online_registration?: boolean
    signup_opens_mode?: string | null
    signup_opens_days_before?: number | null
    online_registration_opens_at?: string | null
    online_registration_closes_at?: string | null
  } | null
  signupSeasons?: Array<{
    id: string
    name: string
    start_date?: string | null
    allow_online_registration?: boolean
    signup_opens_mode?: string | null
    signup_opens_days_before?: number | null
    online_registration_opens_at?: string | null
    online_registration_closes_at?: string | null
  }>
  seasonWaiver: { id: string; title: string; content: string } | null
  seasonRegistrationOpen: boolean
  leagueSite: LeagueSitePayload
}

function seasonSignupClosedDetail(cs: HubPayload['competitiveSeason']): string {
  if (!cs) return 'Book a drop-in from the league page or check back later.'
  if (!cs.allow_online_registration) {
    return 'Online signup is off for this season. Go back or use drop-ins.'
  }
  const now = Date.now()
  const opensIso = effectiveSignupOpensAtIso(cs)
  if (opensIso && now < new Date(opensIso).getTime()) {
    return `Signups open ${new Date(opensIso).toLocaleString()}.`
  }
  if (cs.online_registration_closes_at && now > new Date(cs.online_registration_closes_at).getTime()) {
    return 'Online signups have closed. Go back or use drop-ins.'
  }
  return 'Online signup is not available right now. Go back or use drop-ins.'
}

export default function SeasonRegisterPage() {
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [data, setData] = useState<HubPayload | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [signedInOrg, setSignedInOrg] = useState<{ slug: string; name: string } | null>(null)
  const [accessResolved, setAccessResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/join/${slug}/hub`)
      if (cancelled) return
      if (res.status === 404) {
        setNotFound(true)
        setData(null)
        setLoading(false)
        return
      }
      const json = await res.json().catch(() => null)
      if (!json?.organization) {
        setNotFound(true)
        setData(null)
      } else {
        setData({
          organization: json.organization,
          competitiveSeason: json.competitiveSeason ?? null,
          signupSeasons: Array.isArray(json.signupSeasons) ? json.signupSeasons : [],
          seasonWaiver: json.seasonWaiver ?? null,
          seasonRegistrationOpen: !!json.seasonRegistrationOpen,
          leagueSite: json.leagueSite ?? EMPTY_LEAGUE_SITE,
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const seasons = data?.signupSeasons || []
    if (seasons.length > 0) {
      setSelectedSeasonId((prev) => (prev && seasons.some((s) => s.id === prev) ? prev : seasons[0].id))
      return
    }
    if (data?.competitiveSeason?.id) {
      setSelectedSeasonId(data.competitiveSeason.id)
    }
  }, [data])

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

  const shellPreset = resolveThemePreset(null, null, 'light')

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm font-semibold"
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          background: shellPreset.pageBg,
          color: shellPreset.heading,
        }}
      >
        Loading…
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: shellPreset.pageBg }}
      >
        <p style={{ color: shellPreset.heading, fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          League not found
        </p>
        <p style={{ color: shellPreset.muted, fontSize: '14px', maxWidth: '360px' }}>
          {accessResolved && !signedInOrg
            ? 'Check your registration link with the organizer. If you run the league, copy the URL from Dashboard → Settings.'
            : 'Check your registration link with the organizer.'}
        </p>
        <LeagueNotFoundOrganizerHint signedInOrg={signedInOrg} currentSlug={slug} preset={shellPreset} variant="register" />
      </div>
    )
  }

  const { organization: org, competitiveSeason, seasonWaiver, seasonRegistrationOpen, leagueSite } = data
  const signupSeasons = data.signupSeasons || []
  const selectedSeason =
    signupSeasons.find((s) => s.id === selectedSeasonId) || competitiveSeason || signupSeasons[0] || null
  const regBrand = getPublicThemeInputsForOrg(org)
  const preset = resolveThemePreset(regBrand.primaryColor, regBrand.presetId, regBrand.appearanceMode)
  const heroTheme = publicHeroThemeFromPreset(preset)

  if (!selectedSeason || !seasonRegistrationOpen) {
    return (
      <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <NewsBanner message={org.news_banner} color={org.news_banner_color} />
        <div style={{ position: 'relative' }}>
          <PublicLeagueHeroBand
            orgName={org.name}
            logoUrl={regBrand.usePlatformBranding ? null : org.logo_url}
            heroBackgroundUrl={regBrand.suppressCustomHero ? null : leagueSite.heroBackgroundUrl}
            tagline={leagueSite.heroTagline ?? DEFAULT_LEAGUE_HERO_TAGLINE}
            placeholderInitials={displayHeroInitials(leagueSite.heroInitials, org.name)}
            preset={preset}
            heroTheme={heroTheme}
            usePlatformBranding={regBrand.usePlatformBranding}
            compact
          />
        </div>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Link
            href={`/league/${slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: preset.accent,
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
              marginBottom: '24px',
            }}
          >
            <ChevronLeft size={16} aria-hidden />
            Back to league home
          </Link>
          <div
            style={{
              background: preset.surfaceBg,
              border: `1px solid ${preset.surfaceBorder}`,
              borderRadius: '16px',
              padding: '28px 24px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: preset.heading, fontWeight: 800, margin: '0 0 8px', fontSize: '17px' }}>
              {!competitiveSeason ? 'No season signup available' : 'Season signup closed'}
            </p>
            <p style={{ color: preset.muted, fontSize: '14px', margin: 0, lineHeight: 1.55 }}>
              {seasonSignupClosedDetail(competitiveSeason)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NewsBanner message={org.news_banner} color={org.news_banner_color} />
      <div style={{ position: 'relative' }}>
        <PublicLeagueHeroBand
          orgName={org.name}
          logoUrl={regBrand.usePlatformBranding ? null : org.logo_url}
          heroBackgroundUrl={regBrand.suppressCustomHero ? null : leagueSite.heroBackgroundUrl}
          tagline={leagueSite.heroTagline ?? DEFAULT_LEAGUE_HERO_TAGLINE}
          placeholderInitials={displayHeroInitials(leagueSite.heroInitials, org.name)}
          preset={preset}
          heroTheme={heroTheme}
          usePlatformBranding={regBrand.usePlatformBranding}
          compact
        />
      </div>

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 20px 48px' }}>
        <Link
          href={`/league/${slug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: preset.accent,
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 700,
            marginBottom: '20px',
          }}
        >
          <ChevronLeft size={16} aria-hidden />
          Back to league home
        </Link>

        <p
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: preset.accent,
            marginBottom: '8px',
            letterSpacing: '0.02em',
          }}
        >
          {selectedSeason.name}
        </p>
        {signupSeasons.length > 1 ? (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: preset.muted, marginBottom: '6px' }}>
              Choose a season
            </label>
            <select
              value={selectedSeason.id}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '10px',
                border: `1px solid ${preset.surfaceBorder}`,
                background: preset.surfaceBg,
                color: preset.heading,
                padding: '10px 12px',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'inherit',
              }}
            >
              {signupSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: preset.heading,
            margin: '0 0 20px',
            letterSpacing: '-0.02em',
          }}
        >
          Season registration
        </h1>

        <RegistrationForm
          organizationId={org.id}
          seasonId={selectedSeason.id}
          leagueName={org.name}
          primaryColor={org.primary_color || undefined}
          preset={preset}
          showGuests={false}
          waiverLayout="modal"
          waiverTitle={seasonWaiver?.title ?? null}
          waiverText={seasonWaiver?.content ?? null}
          waiverId={seasonWaiver?.id ?? null}
        />
      </div>
    </div>
  )
}
