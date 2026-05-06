'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Shirt } from 'lucide-react'
import { publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'

interface TeamPayload {
  organization: {
    name: string
    slug: string
    primary_color: string | null
    logo_url: string | null
    league_theme_preset?: string | null
    league_appearance_mode?: string | null
    plan?: string | null
  }
  team: {
    id: string
    name: string
    color: string | null
    season_name: string
  }
  roster: {
    id: string
    full_name: string
    jersey_number: number | null
    position_label: string | null
  }[]
  open_jersey_poll_id: string | null
}

export default function LeaguePublicTeamPage() {
  const params = useParams()
  const slug = params.slug as string
  const teamId = params.teamId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null)
  const [data, setData] = useState<TeamPayload | null>(null)
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      setLoadErrorDetail(null)
      const res = await fetch(`/api/join/${slug}/teams/${teamId}`)
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
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug, teamId])

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
  const accent = data?.team.color || preset.accent
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

  if (notFound || !data) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
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

  const { organization: org, team, roster, open_jersey_poll_id } = data
  const teamStripe = team.color || preset.accent

  return (
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
        <div style={{ width: '100%', maxWidth: '720px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href={`/league/${slug}`}
            style={{ color: preset.heading, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            aria-label="Back to league home"
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
          {org.logo_url ? (
            <img src={org.logo_url} alt="" style={{ height: '32px', width: '32px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
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
          borderBottom: `4px solid ${teamStripe}`,
          padding: '28px 20px 32px',
        }}
      >
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: heroTheme.heroGlow }} />
        <div style={{ position: 'relative', maxWidth: '720px', margin: '0 auto' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {org.logo_url ? (
              <img
                src={org.logo_url}
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
                  fontSize: 'clamp(24px, 5vw, 32px)',
                  fontWeight: 800,
                  color: heroTheme.heroTitle,
                  margin: '4px 0 0',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {team.name}
              </h1>
            </div>
          </div>
          <p style={{ color: heroTheme.heroSubtitle, fontSize: '14px', margin: '14px 0 0', lineHeight: 1.45 }}>{team.season_name}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
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
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 20px 56px' }}>

        {open_jersey_poll_id ? (
          <Link
            href={`/join/${slug}/jersey-poll/${open_jersey_poll_id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: preset.surfaceBg,
              border: `1px solid ${preset.surfaceBorder}`,
              borderRadius: '14px',
              padding: '14px 16px',
              textDecoration: 'none',
              color: 'inherit',
              marginBottom: '14px',
              boxShadow: '0 6px 16px -12px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: preset.accentSoftBg,
                color: preset.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Shirt size={20} strokeWidth={1.6} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: preset.heading, marginBottom: '2px' }}>
                Jersey number poll
              </div>
              <div style={{ fontSize: '13px', color: preset.muted, lineHeight: 1.45 }}>
                Submit or update your preferred number for this team.
              </div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: preset.accent, background: preset.accentSoftBg, borderRadius: '999px', padding: '4px 8px' }}>
              Open
            </span>
          </Link>
        ) : null}

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
            Roster
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
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => (
                    <tr key={p.id} style={{ borderTop: `1px solid ${preset.surfaceBorder}`, color: preset.heading }}>
                      <td style={{ padding: '12px 14px', color: preset.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {p.jersey_number !== null && p.jersey_number !== undefined ? p.jersey_number : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{p.full_name}</td>
                      <td style={{ padding: '12px 14px', color: preset.muted }}>
                        {p.position_label || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
