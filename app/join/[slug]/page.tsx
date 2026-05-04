'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CalendarDays, ChevronRight, Trophy } from 'lucide-react'
import NewsBanner from '@/components/NewsBanner'

interface HubOrg {
  id: string
  name: string
  slug: string
  primary_color: string | null
  logo_url: string | null
  news_banner: string | null
  news_banner_color: string | null
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

function seasonSignupClosedDetail(cs: CompetitiveSeason | null): string {
  if (!cs) return 'Try drop-ins below or ask when registration opens.'
  if (!cs.allow_online_registration) {
    return `Public registration is off for ${cs.name}. Use drop-ins or ask your league.`
  }
  const now = Date.now()
  if (cs.online_registration_opens_at && now < new Date(cs.online_registration_opens_at).getTime()) {
    return `Signups open ${new Date(cs.online_registration_opens_at).toLocaleString()}.`
  }
  if (cs.online_registration_closes_at && now > new Date(cs.online_registration_closes_at).getTime()) {
    return 'Online signups have closed. Try drop-ins or ask your league.'
  }
  return 'Use drop-ins or check back later.'
}

interface HubResponse {
  organization: HubOrg
  competitiveSeason: CompetitiveSeason | null
  seasonRegistrationOpen: boolean
}

export default function JoinHubPage() {
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hub, setHub] = useState<HubResponse | null>(null)
  const [dropInCount, setDropInCount] = useState(0)

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

  const accent = hub?.organization.primary_color || '#5a7a2a'

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#f2ead6] flex items-center justify-center text-[#1a1a0a] text-sm font-semibold"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        Loading…
      </div>
    )
  }

  if (notFound || !hub) {
    return (
      <div
        className="min-h-screen bg-[#f2ead6] flex flex-col items-center justify-center px-6 text-center"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        <p style={{ color: '#1a1a0a', fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          League not found
        </p>
        <p style={{ color: '#9a8c6a', fontSize: '14px', maxWidth: '360px' }}>
          Check the link or ask your organizer for the correct registration URL.
        </p>
      </div>
    )
  }

  const { organization: org, competitiveSeason, seasonRegistrationOpen } = hub

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NewsBanner message={org.news_banner} color={org.news_banner_color} />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px 56px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={org.name}
              style={{
                height: '56px',
                width: 'auto',
                objectFit: 'contain',
                marginBottom: '16px',
                borderRadius: '8px',
              }}
            />
          ) : null}
          <h1
            style={{
              fontSize: 'clamp(26px, 5vw, 34px)',
              fontWeight: 800,
              color: '#1a1a0a',
              margin: '0 0 10px',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {org.name}
          </h1>
          <p style={{ color: '#9a8c6a', fontSize: '15px', margin: 0, lineHeight: 1.5 }}>
            Register for the season or book a drop-in session.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {competitiveSeason && seasonRegistrationOpen ? (
            <Link
              href={`/join/${slug}/register`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'white',
                border: '1px solid #d4c9a8',
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
                  background: `${accent}18`,
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
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a0a', marginBottom: '4px' }}>
                  Join the season
                </div>
                <div style={{ fontSize: '13px', color: '#9a8c6a', lineHeight: 1.45 }}>
                  {competitiveSeason.name}
                </div>
              </div>
              <ChevronRight size={22} color="#9a8c6a" style={{ flexShrink: 0 }} aria-hidden />
            </Link>
          ) : competitiveSeason && !seasonRegistrationOpen ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: '#f8f6f0',
                border: '1px dashed #d4c9a8',
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
                  background: '#ede5cc',
                  color: '#9a8c6a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trophy size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#6b5e3a', marginBottom: '4px' }}>
                  Season signup not online
                </div>
                <div style={{ fontSize: '13px', color: '#9a8c6a', lineHeight: 1.45 }}>
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
                background: '#f8f6f0',
                border: '1px dashed #d4c9a8',
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
                  background: '#ede5cc',
                  color: '#9a8c6a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trophy size={24} strokeWidth={1.5} aria-hidden />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#6b5e3a', marginBottom: '4px' }}>
                  No season signup open
                </div>
                <div style={{ fontSize: '13px', color: '#9a8c6a', lineHeight: 1.45 }}>
                  Try drop-ins below or ask when registration opens.
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
              background: 'white',
              border: '1px solid #d4c9a8',
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
                background: `${accent}18`,
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
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a0a', marginBottom: '4px' }}>
                Drop-in sessions
              </div>
              <div style={{ fontSize: '13px', color: '#9a8c6a', lineHeight: 1.45 }}>
                {dropInCount === 0
                  ? 'No upcoming sessions right now'
                  : `${dropInCount} upcoming session${dropInCount === 1 ? '' : 's'} available`}
              </div>
            </div>
            <ChevronRight size={22} color="#9a8c6a" style={{ flexShrink: 0 }} aria-hidden />
          </Link>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#c8b98a',
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
