'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Shirt, CheckCircle2 } from 'lucide-react'

interface HubPayload {
  organization: { name: string; slug: string; primary_color: string | null }
  poll: {
    id: string
    status: string
    team_name: string
    team_color: string | null
    season_name: string
    roster_count: number
  }
}

export default function JerseyPollPage() {
  const params = useParams()
  const slug = params.slug as string
  const pollId = params.pollId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [planBlocked, setPlanBlocked] = useState(false)
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null)
  const [data, setData] = useState<HubPayload | null>(null)
  const [email, setEmail] = useState('')
  const [preferred, setPreferred] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      setPlanBlocked(false)
      setLoadErrorDetail(null)
      const res = await fetch(`/api/join/${slug}/jersey-poll/${pollId}`)
      if (cancelled) return
      const json = await res.json().catch(() => null)
      const blocked = res.status === 403
      if (cancelled) return
      setPlanBlocked(blocked)
      if (!res.ok || !json?.poll || !json?.organization) {
        setNotFound(true)
        setData(null)
        const hint =
          typeof json?.error === 'string'
            ? json.error
            : !res.ok
              ? `Could not load poll (${res.status}).`
              : null
        setLoadErrorDetail(hint)
      } else {
        setData(json)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug, pollId])

  const accent = data?.organization.primary_color || data?.poll.team_color || '#5a7a2a'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const n = parseInt(preferred, 10)
    if (Number.isNaN(n) || n < 0 || n > 99) {
      setError('Enter a jersey number from 0 to 99.')
      setSubmitting(false)
      return
    }
    if (!email.trim()) {
      setError('Enter the email you used to register for this season.')
      setSubmitting(false)
      return
    }
    try {
      const res = await fetch(`/api/join/${slug}/jersey-poll/${pollId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, preferred_number: n }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || 'Could not save your pick.')
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Try again.')
    }
    setSubmitting(false)
  }

  const inputStyle = {
    width: '100%',
    background: '#f8f6f0',
    border: '0.5px solid #d4c9a8',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '16px',
    color: '#1a1a0a',
    fontFamily: 'inherit',
    outline: 'none',
  }
  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: '#9a8c6a',
    marginBottom: '6px',
  }

  const shell = { minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' as const }

  if (loading) {
    return (
      <div style={shell}>
        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '48px 20px', textAlign: 'center', color: '#9a8c6a' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div style={shell}>
        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', color: '#57534e', marginBottom: loadErrorDetail ? '12px' : 0 }}>
            {planBlocked
              ? 'Jersey number polls are not available for this league on its current plan.'
              : 'This jersey poll link is invalid or no longer available.'}
          </p>
          {loadErrorDetail && (
            <p
              style={{
                fontSize: '13px',
                color: '#78716c',
                lineHeight: 1.5,
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
              }}
            >
              {loadErrorDetail}
            </p>
          )}
          <p style={{ fontSize: '12px', color: '#a8a29e', marginTop: '16px', lineHeight: 1.45 }}>
            {planBlocked
              ? 'Ask your organizer if you were expecting to pick a number. They may need to upgrade the league or reopen a poll after upgrading.'
              : 'Use the link from your organizer (Dashboard → Teams → Copy link). The URL must include your league slug and the poll id from an open poll.'}
          </p>
        </div>
      </div>
    )
  }

  if (data.poll.status !== 'open') {
    return (
      <div style={shell}>
        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
          <Link
            href={`/league/${slug}`}
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
          <p style={{ fontSize: '15px', color: '#57534e' }}>
            The jersey poll for <strong>{data.poll.team_name}</strong> is closed. Contact your league if you still need a number.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={shell}>
        <div style={{ maxWidth: '440px', margin: '0 auto', padding: '32px 20px' }}>
          <Link
            href={`/league/${slug}`}
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
          <div
            style={{
              background: 'white',
              border: '0.5px solid #d4c9a8',
              borderRadius: '14px',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: accent }}>
              <CheckCircle2 size={48} strokeWidth={1.5} aria-hidden />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a0a', marginBottom: '8px' }}>
              Preference saved
            </h1>
            <p style={{ fontSize: '14px', color: '#6b6560', lineHeight: 1.5 }}>
              Your coach will confirm final jersey numbers. You can submit again on this page if you change your mind while the poll is open.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={shell}>
      <div style={{ maxWidth: '440px', margin: '0 auto', padding: '32px 20px 48px' }}>
        <Link
          href={`/league/${slug}`}
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
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '14px',
            background: `${accent}18`,
            color: accent,
            marginBottom: '12px',
          }}
        >
          <Shirt size={28} strokeWidth={1.5} aria-hidden />
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a0a', marginBottom: '4px' }}>
          Jersey number poll
        </h1>
        <p style={{ fontSize: '14px', color: '#6b6560', lineHeight: 1.4 }}>
          {data.organization.name}
        </p>
        <p style={{ fontSize: '13px', color: '#9a8c6a', marginTop: '8px' }}>
          <span style={{ fontWeight: 700, color: '#1a1a0a' }}>{data.poll.team_name}</span>
          {' · '}
          {data.poll.season_name}
        </p>
        {data.poll.roster_count > 0 && (
          <p style={{ fontSize: '12px', color: '#9a8c6a', marginTop: '4px' }}>
            {data.poll.roster_count} player{data.poll.roster_count === 1 ? '' : 's'} on this team
          </p>
        )}
        </div>

        <form
        onSubmit={handleSubmit}
        style={{
          background: 'white',
          border: '0.5px solid #d4c9a8',
          borderRadius: '14px',
          padding: '24px 20px',
        }}
      >
        <p style={{ fontSize: '13px', color: '#57534e', lineHeight: 1.5, marginBottom: '20px' }}>
          Enter the email you used when you registered for this season, then your preferred jersey number (0–99).
          Final numbers are assigned by your organizer and must stay unique across the season roster.
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="jp-email" style={labelStyle}>Email</label>
          <input
            id="jp-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="jp-num" style={labelStyle}>Preferred jersey #</label>
          <input
            id="jp-num"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
            placeholder="e.g. 23"
            style={inputStyle}
          />
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '0.5px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#b91c1c',
              marginBottom: '14px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 700,
            fontSize: '15px',
            fontFamily: 'inherit',
            cursor: submitting ? 'wait' : 'pointer',
            background: accent,
            color: '#fff',
            opacity: submitting ? 0.75 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Submit preference'}
        </button>
        </form>
      </div>
    </div>
  )
}
