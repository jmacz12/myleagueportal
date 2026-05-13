'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, ChevronLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import NewsBanner from '@/components/NewsBanner'
import { PublicLeagueHeroBand } from '@/components/league-site/PublicLeagueHeroBand'
import { useParams } from 'next/navigation'
import {
  contrastTextForAccent,
  dropinPublicPageBackdrop,
  publicHeroThemeFromPreset,
  resolveThemePreset,
} from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'
import type { LeagueSitePayload } from '@/lib/league-site'
import { DEFAULT_LEAGUE_HERO_TAGLINE, EMPTY_LEAGUE_SITE, displayHeroInitials } from '@/lib/league-site'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DropinSignupRow = { full_name: string }

type JoinDropinSession = {
  id: string
  name?: string
  scheduled_at?: string
  is_recurring?: boolean
  location?: string | null
  max_players?: number
  max_waitlist?: number
  fee_amount?: number
  signups?: DropinSignupRow[]
  waitlist?: DropinSignupRow[]
  [key: string]: unknown
}

function dropinJoinState(s: JoinDropinSession) {
  const cap = typeof s.max_players === 'number' ? s.max_players : 0
  const maxWl = typeof s.max_waitlist === 'number' ? s.max_waitlist : 0
  const roster = Array.isArray(s.signups) ? s.signups.length : 0
  const wl = Array.isArray(s.waitlist) ? s.waitlist.length : 0
  const rosterFull = cap > 0 && roster >= cap
  const waitlistFull = maxWl > 0 && wl >= maxWl
  const fullyClosed = rosterFull && (maxWl <= 0 || waitlistFull)
  const joiningWaitlist = rosterFull && maxWl > 0 && !waitlistFull
  return { cap, maxWl, roster, wl, rosterFull, waitlistFull, fullyClosed, joiningWaitlist }
}

type DropinWaiverRow = {
  id: string
  title?: string | null
  content?: string | null
  [key: string]: unknown
}

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
    sport_template_id?: string | null
  } | null>(null)
  const [leagueSite, setLeagueSite] = useState<LeagueSitePayload>(EMPTY_LEAGUE_SITE)
  const [sessions, setSessions] = useState<JoinDropinSession[]>([])
  const [waiver, setWaiver] = useState<DropinWaiverRow | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedSession, setSelectedSession] = useState<JoinDropinSession | null>(null)
  const [formData, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [agreedToWaiver, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registeredWaitlist, setRegisteredWaitlist] = useState(false)
  const [expandedPlayersBySession, setExpandedPlayersBySession] = useState<Record<string, boolean>>({})

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

  const selectedJoin = selectedSession ? dropinJoinState(selectedSession) : null
  const pageBackground = useMemo(() => dropinPublicPageBackdrop(preset), [preset])

  const formatLocalTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const timeZone = org?.league_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone }),
      zone: date.toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone }).split(' ').pop() || '',
    }
  }

  function togglePlayers(sessionId: string) {
    setExpandedPlayersBySession((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  function seriesBaseName(s: JoinDropinSession): string {
    const raw = String(s.name || '').trim()
    if (!raw) return s.id
    return raw.split(' —')[0].trim() || raw
  }

  const sessionsForRender = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(String(a.scheduled_at || '')).getTime() - new Date(String(b.scheduled_at || '')).getTime()
    )
    const seenBase = new Set<string>()
    const out: JoinDropinSession[] = []
    for (const s of sorted) {
      if (!s.is_recurring) {
        out.push(s)
        continue
      }
      const base = seriesBaseName(s)
      if (!seenBase.has(base)) {
        seenBase.add(base)
        out.push(s) // Always show next upcoming instance.
        continue
      }
    }
    return out
  }, [sessions])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSession) return
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
      setRegisteredWaitlist(Boolean((body as { waitlist?: boolean }).waitlist))
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

  const loadingBackdrop = useMemo(
    () => dropinPublicPageBackdrop(resolveThemePreset(null, null, 'light')),
    []
  )

  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'max(80px, 18vh) max(20px, env(safe-area-inset-left)) max(40px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-right))',
          color: shellPreset.muted,
          background: loadingBackdrop,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          minHeight: '100vh',
        }}
      >
        Loading sessions…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBackground, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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

      <div className="dropin-public-main" style={{ paddingTop: org ? 28 : 40 }}>
        {!selectedSession ? (
          <>
            <Link
              href={`/league/${slug}`}
              className="dropin-public-back-link"
              style={{
                color: preset.accent,
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <ChevronLeft size={18} aria-hidden /> Back to league home
            </Link>

            <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2rem)', fontWeight: 800, color: preset.heading, marginTop: '18px', marginBottom: '8px', letterSpacing: '-0.01em' }}>
              Available Drop-ins
            </h1>
            <p style={{ color: preset.muted, marginBottom: '24px', lineHeight: 1.55, maxWidth: '62ch' }}>
              Book your spot for upcoming sessions. Recurring runs show the next session by default to keep this page clean - use
              the league home schedule for the full season timeline.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sessions.length === 0 ? (
                <div
                  style={{
                    padding: '34px 24px',
                    textAlign: 'center',
                    background: preset.surfaceBg,
                    borderRadius: '16px',
                    border: `1px solid ${preset.surfaceBorder}`,
                    boxShadow: '0 16px 34px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: preset.accent }}>
                    <CalendarDays size={36} strokeWidth={1.25} aria-hidden />
                  </div>
                  <p style={{ color: preset.heading, fontWeight: 700, margin: 0 }}>No upcoming sessions</p>
                  <p style={{ color: preset.muted, fontSize: '14px', margin: '8px 0 0' }}>Check back soon for new dates.</p>
                </div>
              ) : (
                sessionsForRender.map((s) => {
                  const local = formatLocalTime(typeof s.scheduled_at === 'string' ? s.scheduled_at : '')
                  const signups = Array.isArray(s.signups) ? s.signups : []
                  const waitlisted = Array.isArray(s.waitlist) ? s.waitlist : []
                  const j = dropinJoinState(s)
                  const buttonLabel = j.fullyClosed ? 'FULL' : j.joiningWaitlist ? 'JOIN WAITLIST' : 'JOIN'
                  const playersExpanded = !!expandedPlayersBySession[s.id]
                  return (
                    <div
                      key={s.id}
                      className="dropin-public-session-card"
                      style={{
                        background: preset.surfaceBg,
                        padding: '18px 16px',
                        borderRadius: '18px',
                        border: `1px solid ${preset.surfaceBorder}`,
                        boxShadow: '0 14px 30px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: 'clamp(1.05rem, 3.5vw, 1.15rem)', fontWeight: 800, color: preset.heading, lineHeight: 1.3 }}>{s.name}</h3>
                        <p style={{ margin: '8px 0 4px', fontSize: '14px', color: preset.muted, lineHeight: 1.5 }}>
                          {local.day} @ {local.time} {local.zone}
                        </p>
                        <p style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800, color: preset.accent }}>${s.fee_amount}</p>
                        {j.cap > 0 ? (
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: preset.muted }}>
                            <strong style={{ color: preset.heading }}>{signups.length}</strong> / {j.cap} spots taken
                          </p>
                        ) : null}
                        {j.maxWl > 0 ? (
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: preset.muted }}>
                            Waitlist <strong style={{ color: preset.heading }}>{waitlisted.length}</strong> / {j.maxWl}
                          </p>
                        ) : null}
                        {playersExpanded ? (
                          <div style={{ marginTop: '14px', display: 'grid', gap: '14px' }}>
                            <div>
                              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: preset.muted }}>
                                Roster ({signups.length})
                              </p>
                              {signups.length === 0 ? (
                                <p style={{ margin: 0, fontSize: '13px', color: preset.muted }}>No sign-ups yet — be the first.</p>
                              ) : (
                                <div style={{ display: 'grid', gap: '6px' }}>
                                  {signups.map((row, i: number) => (
                                    <div key={`${s.id}-${i}-${row.full_name}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: preset.accentSoftBg, border: `1px solid ${preset.surfaceBorder}`, borderRadius: '10px', padding: '10px 12px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 800, color: preset.heading, minWidth: '24px' }}>#{i + 1}</span>
                                      <span style={{ fontSize: '13px', color: preset.body }}>{row.full_name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {j.maxWl > 0 ? (
                              <div>
                                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: preset.muted }}>
                                  Waitlist ({waitlisted.length})
                                </p>
                                {waitlisted.length === 0 ? (
                                  <p style={{ margin: 0, fontSize: '13px', color: preset.muted }}>No one on the waitlist yet.</p>
                                ) : (
                                  <div style={{ display: 'grid', gap: '6px' }}>
                                    {waitlisted.map((row, i: number) => (
                                      <div key={`${s.id}-wl-${i}-${row.full_name}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: preset.accentSoftBg, border: `1px solid ${preset.surfaceBorder}`, borderRadius: '10px', padding: '10px 12px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: preset.heading, minWidth: '24px' }}>#{i + 1}</span>
                                        <span style={{ fontSize: '13px', color: preset.body }}>{row.full_name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="dropin-public-session-actions">
                        <button
                          type="button"
                          onClick={() => togglePlayers(s.id)}
                          className="dropin-public-touch-btn"
                          style={{
                            background: 'transparent',
                            color: preset.heading,
                            border: `1px solid ${preset.surfaceBorder}`,
                            fontWeight: 700,
                            cursor: 'pointer',
                            borderRadius: '12px',
                            fontSize: '13px',
                          }}
                        >
                          {playersExpanded ? 'Hide players' : 'Show players'}
                        </button>
                        <button
                          type="button"
                          disabled={j.fullyClosed}
                          onClick={() => !j.fullyClosed && setSelectedSession(s)}
                          className="dropin-public-touch-btn"
                          style={{
                            ...btnPrimary,
                            borderRadius: '12px',
                            fontSize: '13px',
                            letterSpacing: '0.04em',
                            opacity: j.fullyClosed ? 0.45 : 1,
                            cursor: j.fullyClosed ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {buttonLabel}
                        </button>
                      </div>
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
              padding: '40px 24px',
              borderRadius: '20px',
              border: `1px solid ${preset.surfaceBorder}`,
              boxShadow: '0 16px 34px rgba(0,0,0,0.06)',
            }}
          >
            <CheckCircle size={64} color={preset.accent} style={{ margin: '0 auto 20px' }} aria-hidden />
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: preset.heading, marginBottom: '12px' }}>
              {registeredWaitlist ? "You're on the waitlist" : 'Spot reserved'}
            </h2>
            <p style={{ color: preset.muted, lineHeight: 1.6, marginBottom: '32px' }}>
              {registeredWaitlist ? (
                <>
                  We&apos;ll email you if a spot opens for{' '}
                  <strong style={{ color: preset.heading }}>{selectedSession.name}</strong>. Plan on{' '}
                  <strong>${selectedSession.fee_amount}</strong> if you get called up.
                </>
              ) : (
                <>
                  You are registered for <strong style={{ color: preset.heading }}>{selectedSession.name}</strong>. Please bring{' '}
                  <strong>${selectedSession.fee_amount}</strong> to the session.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="dropin-public-touch-btn"
              style={{ ...btnPrimary, width: '100%', padding: '16px 18px' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ background: preset.surfaceBg, padding: '26px 20px', borderRadius: '20px', border: `1px solid ${preset.surfaceBorder}`, boxShadow: '0 16px 34px rgba(0,0,0,0.06)' }}>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="dropin-public-back-link"
              style={{
                background: 'none',
                border: 'none',
                color: preset.muted,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              ← Cancel
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: preset.heading, marginBottom: '4px' }}>Register for session</h2>
            <p style={{ color: preset.muted, fontSize: '14px', marginBottom: '24px' }}>{selectedSession.name}</p>
            {selectedJoin?.joiningWaitlist ? (
              <p style={{ color: preset.muted, fontSize: '13px', margin: '-16px 0 24px', lineHeight: 1.5 }}>
                Roster is full — you&apos;ll join the waitlist (max {selectedJoin.maxWl}). If a spot opens, the organizer may
                reach out.
              </p>
            ) : null}

            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                placeholder="First name"
                required
                className="dropin-public-input"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px 14px',
                  minHeight: '48px',
                  borderRadius: '10px',
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
                className="dropin-public-input"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px 14px',
                  minHeight: '48px',
                  borderRadius: '10px',
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
                className="dropin-public-input"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px 14px',
                  minHeight: '48px',
                  borderRadius: '10px',
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
                      minHeight: '120px',
                      maxHeight: 'min(40vh, 220px)',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      fontSize: '13px',
                      color: preset.muted,
                      marginBottom: '12px',
                      lineHeight: 1.55,
                    }}
                  >
                    {waiver.content}
                  </div>
                  <label className="dropin-public-waiver-label" style={{ fontSize: '14px', fontWeight: 700, color: preset.heading }}>
                    <input type="checkbox" required checked={agreedToWaiver} onChange={(e) => setAgreed(e.target.checked)} />
                    <span>I agree to the liability waiver</span>
                  </label>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="dropin-public-touch-btn"
                style={{ ...btnPrimary, width: '100%', padding: '16px 18px', marginTop: '4px' }}
              >
                {submitting
                  ? 'Submitting…'
                  : selectedJoin?.joiningWaitlist
                    ? `Join waitlist — $${selectedSession.fee_amount}`
                    : `Confirm spot — $${selectedSession.fee_amount}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
