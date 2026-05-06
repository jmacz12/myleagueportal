'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, ChevronLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import NewsBanner from '@/components/NewsBanner'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import { useParams } from 'next/navigation'
import { contrastTextForAccent, publicHeroThemeFromPreset, resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import type { LeagueSitePayload } from '@/lib/league-site'
import { DEFAULT_LEAGUE_HERO_TAGLINE, EMPTY_LEAGUE_SITE, displayHeroInitials } from '@/lib/league-site'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DropinsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [org, setOrg] = useState<{
    id: string
    name: string
    slug: string
    logo_url: string | null
    primary_color: string | null
    league_theme_preset?: string | null
    league_appearance_mode?: string | null
    plan?: string | null
    news_banner: string | null
    news_banner_color: string | null
    league_timezone?: string | null
  } | null>(null)
  const [leagueSite, setLeagueSite] = useState<LeagueSitePayload>(EMPTY_LEAGUE_SITE)
  const [sessions, setSessions] = useState<any[]>([])
  const [waiver, setWaiver] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [formData, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [agreedToWaiver, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    async function loadData() {
      const res = await fetch(`/api/join/${slug}/sessions`)
      const json = await res.json().catch(() => ({}))
      setSessions(Array.isArray(json.sessions) ? json.sessions : [])
      setLeagueSite(json.leagueSite ?? EMPTY_LEAGUE_SITE)

      const orgData = json.organization
      if (orgData) {
        setOrg(orgData)
        const { data: wData } = await supabase
          .from('waivers')
          .select('*')
          .eq('organization_id', orgData.id)
          .eq('type', 'dropin')
          .eq('is_active', true)
          .maybeSingle()
        setWaiver(wData)
      }
      setLoading(false)
    }
    loadData()
  }, [slug])

  const preset = useMemo(() => {
    if (!org) return resolveThemePreset('#5a7a2a', 'classic', 'light')
    const b = getPublicThemeInputsForOrg(org)
    return resolveThemePreset(b.primaryColor, b.presetId, b.appearanceMode)
  }, [org])

  const heroTheme = useMemo(() => publicHeroThemeFromPreset(preset), [preset])

  const shellPreset = resolveThemePreset(null, null, 'light')

  const formatLocalTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const timeZone = org?.league_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone }),
      zone: date.toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone }).split(' ').pop() || '',
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (waiver && !agreedToWaiver) return alert('You must agree to the waiver.')
    setSubmitting(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: selectedSession.id,
        organization_id: org!.id,
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        waiver_accepted: !!waiver ? agreedToWaiver : false,
        waiver_id: waiver?.id ?? null,
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setRegistered(true)
    } else {
      const msg =
        typeof body.error === 'string'
          ? body.error
          : typeof (body as { detail?: string }).detail === 'string'
            ? (body as { detail: string }).detail
            : 'Registration failed. Please try again.'
      alert(msg)
    }
    setSubmitting(false)
  }

  const btnPrimary = {
    background: preset.accent,
    color: contrastTextForAccent(preset.accent),
    border: 'none',
    fontWeight: 800 as const,
    cursor: 'pointer' as const,
    borderRadius: '12px',
  }

  const dropinBrand = org ? getPublicThemeInputsForOrg(org) : null

  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '100px',
          color: shellPreset.muted,
          background: shellPreset.pageBg,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          minHeight: '100vh',
        }}
      >
        Loading sessions…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: preset.pageBg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NewsBanner message={org?.news_banner} color={org?.news_banner_color} />

      {org && dropinBrand ? (
        <div style={{ position: 'relative' }}>
          <PublicLeagueHeroBand
            orgName={org.name}
            logoUrl={dropinBrand.usePlatformBranding ? null : org.logo_url}
            heroBackgroundUrl={dropinBrand.suppressCustomHero ? null : leagueSite.heroBackgroundUrl}
            tagline={leagueSite.heroTagline ?? DEFAULT_LEAGUE_HERO_TAGLINE}
            placeholderInitials={displayHeroInitials(leagueSite.heroInitials, org.name)}
            preset={preset}
            heroTheme={heroTheme}
            usePlatformBranding={dropinBrand.usePlatformBranding}
            compact
          />
        </div>
      ) : null}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: org ? '28px 20px 40px' : '40px 20px' }}>
        {!selectedSession ? (
          <>
            <Link
              href={`/league/${slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: preset.accent,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <ChevronLeft size={16} aria-hidden /> Back to league home
            </Link>

            <h1 style={{ fontSize: '28px', fontWeight: 800, color: preset.heading, marginTop: '20px', marginBottom: '8px' }}>
              Available Drop-ins
            </h1>
            <p style={{ color: preset.muted, marginBottom: '32px' }}>Book your spot for an upcoming session.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sessions.length === 0 ? (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: preset.surfaceBg,
                    borderRadius: '12px',
                    border: `1px solid ${preset.surfaceBorder}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: preset.accent }}>
                    <CalendarDays size={36} strokeWidth={1.25} aria-hidden />
                  </div>
                  <p style={{ color: preset.heading, fontWeight: 700, margin: 0 }}>No upcoming sessions</p>
                  <p style={{ color: preset.muted, fontSize: '14px', margin: '8px 0 0' }}>Check back soon for new dates.</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const local = formatLocalTime(s.scheduled_at)
                  const signups = Array.isArray(s.signups) ? s.signups : []
                  const cap = typeof s.max_players === 'number' ? s.max_players : 0
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: preset.surfaceBg,
                        padding: '24px',
                        borderRadius: '16px',
                        border: `1px solid ${preset.surfaceBorder}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: preset.heading }}>{s.name}</h3>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: preset.muted }}>
                          {local.day} @ {local.time} {local.zone}
                        </p>
                        <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: preset.accent }}>${s.fee_amount}</p>
                        {cap > 0 ? (
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: preset.muted }}>
                            <strong style={{ color: preset.heading }}>{signups.length}</strong> / {cap} spots taken
                          </p>
                        ) : null}
                        <div style={{ marginTop: '10px' }}>
                          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: preset.muted }}>
                            Who&apos;s in ({signups.length})
                          </p>
                          {signups.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '13px', color: preset.muted }}>No sign-ups yet — be the first.</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '18px', color: preset.body, fontSize: '13px', lineHeight: 1.5 }}>
                              {signups.map((row: { full_name: string }, i: number) => (
                                <li key={`${s.id}-${i}-${row.full_name}`}>{row.full_name}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSession(s)}
                        style={{
                          ...btnPrimary,
                          padding: '12px 24px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        JOIN
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : registered ? (
          <div
            style={{
              textAlign: 'center',
              background: preset.surfaceBg,
              padding: '48px 32px',
              borderRadius: '20px',
              border: `1px solid ${preset.surfaceBorder}`,
            }}
          >
            <CheckCircle size={64} color={preset.accent} style={{ margin: '0 auto 20px' }} aria-hidden />
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: preset.heading, marginBottom: '12px' }}>Spot reserved</h2>
            <p style={{ color: preset.muted, lineHeight: 1.6, marginBottom: '32px' }}>
              You are registered for <strong style={{ color: preset.heading }}>{selectedSession.name}</strong>. Please bring{' '}
              <strong>${selectedSession.fee_amount}</strong> to the session.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ ...btnPrimary, width: '100%', padding: '16px' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ background: preset.surfaceBg, padding: '32px', borderRadius: '20px', border: `1px solid ${preset.surfaceBorder}` }}>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              style={{
                background: 'none',
                border: 'none',
                color: preset.muted,
                cursor: 'pointer',
                fontSize: '13px',
                padding: 0,
                marginBottom: '20px',
              }}
            >
              ← Cancel
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: preset.heading, marginBottom: '4px' }}>Register for session</h2>
            <p style={{ color: preset.muted, fontSize: '14px', marginBottom: '24px' }}>{selectedSession.name}</p>

            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                placeholder="First name"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.accentSoftBg,
                  color: preset.heading,
                  fontFamily: 'inherit',
                }}
                onChange={(e) => setForm({ ...formData, firstName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Last name"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.accentSoftBg,
                  color: preset.heading,
                  fontFamily: 'inherit',
                }}
                onChange={(e) => setForm({ ...formData, lastName: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email address"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.accentSoftBg,
                  color: preset.heading,
                  fontFamily: 'inherit',
                }}
                onChange={(e) => setForm({ ...formData, email: e.target.value })}
              />

              {waiver ? (
                <div
                  style={{
                    background: preset.accentSoftBg,
                    padding: '16px',
                    borderRadius: '8px',
                    border: `1px solid ${preset.surfaceBorder}`,
                  }}
                >
                  <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: preset.heading }}>
                    {waiver.title}
                  </h4>
                  <div
                    style={{
                      height: '100px',
                      overflowY: 'auto',
                      fontSize: '11px',
                      color: preset.muted,
                      marginBottom: '12px',
                      lineHeight: 1.5,
                    }}
                  >
                    {waiver.content}
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: preset.heading,
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" required checked={agreedToWaiver} onChange={(e) => setAgreed(e.target.checked)} />
                    I agree to the liability waiver
                  </label>
                </div>
              ) : null}

              <button type="submit" disabled={submitting} style={{ ...btnPrimary, padding: '16px', marginTop: '8px' }}>
                {submitting ? 'Reserving…' : `Confirm spot — $${selectedSession.fee_amount}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
