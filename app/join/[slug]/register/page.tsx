'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import NewsBanner from '@/components/NewsBanner'
import RegistrationForm from '../RegistrationForm'

interface HubPayload {
  organization: {
    id: string
    name: string
    primary_color: string | null
    news_banner: string | null
    news_banner_color: string | null
  }
  competitiveSeason: {
    id: string
    name: string
    allow_online_registration?: boolean
    online_registration_opens_at?: string | null
    online_registration_closes_at?: string | null
  } | null
  seasonWaiver: { id: string; title: string; content: string } | null
  seasonRegistrationOpen: boolean
}

function seasonSignupClosedDetail(cs: HubPayload['competitiveSeason']): string {
  if (!cs) return 'Book a drop-in from the league page or check back later.'
  if (!cs.allow_online_registration) {
    return 'Online signup is off for this season. Go back or use drop-ins.'
  }
  const now = Date.now()
  if (cs.online_registration_opens_at && now < new Date(cs.online_registration_opens_at).getTime()) {
    return `Signups open ${new Date(cs.online_registration_opens_at).toLocaleString()}.`
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
          seasonWaiver: json.seasonWaiver ?? null,
          seasonRegistrationOpen: !!json.seasonRegistrationOpen,
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

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

  if (notFound || !data) {
    return (
      <div
        className="min-h-screen bg-[#f2ead6] flex flex-col items-center justify-center px-6 text-center"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        <p style={{ color: '#1a1a0a', fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>
          League not found
        </p>
        <p style={{ color: '#9a8c6a', fontSize: '14px' }}>Check your registration link with the organizer.</p>
      </div>
    )
  }

  const { organization: org, competitiveSeason, seasonWaiver, seasonRegistrationOpen } = data

  if (!competitiveSeason || !seasonRegistrationOpen) {
    return (
      <div style={{ minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <NewsBanner message={org.news_banner} color={org.news_banner_color} />
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Link
            href={`/join/${slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#5a7a2a',
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
              background: 'white',
              border: '1px solid #d4c9a8',
              borderRadius: '16px',
              padding: '28px 24px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#1a1a0a', fontWeight: 800, margin: '0 0 8px', fontSize: '17px' }}>
              {!competitiveSeason ? 'No active season' : 'Season signup closed'}
            </p>
            <p style={{ color: '#9a8c6a', fontSize: '14px', margin: 0, lineHeight: 1.55 }}>
              {seasonSignupClosedDetail(competitiveSeason)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NewsBanner message={org.news_banner} color={org.news_banner_color} />

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 20px 48px' }}>
        <Link
          href={`/join/${slug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#5a7a2a',
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
            color: '#5a7a2a',
            marginBottom: '8px',
            letterSpacing: '0.02em',
          }}
        >
          {competitiveSeason.name}
        </p>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#1a1a0a',
            margin: '0 0 20px',
            letterSpacing: '-0.02em',
          }}
        >
          Season registration
        </h1>

        <RegistrationForm
          organizationId={org.id}
          seasonId={competitiveSeason.id}
          leagueName={org.name}
          primaryColor={org.primary_color || undefined}
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
