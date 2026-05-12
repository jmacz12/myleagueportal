'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { StreamWithOverlay } from '@/components/public-stream/StreamWithOverlay'

type StreamLive = {
  gameId: string
  streamPageUrl: string | null
  homeName: string | null
  awayName: string | null
} | null

export default function LeagueWatchStreamPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const [live, setLive] = useState<StreamLive | undefined>(undefined)
  const [accent, setAccent] = useState('#5a7a2a')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`/api/join/${encodeURIComponent(slug)}/hub`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const c = d?.organization?.primary_color
        if (typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)) setAccent(c)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`/api/join/${encodeURIComponent(slug)}/stream`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setLive(d?.live ?? null)
      })
      .catch(() => {
        if (!cancelled) setLive(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const leagueHome = slug ? `/league/${encodeURIComponent(slug)}` : '/'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
        padding: '20px 16px 32px',
      }}
    >
      <div style={{ maxWidth: 'min(960px, 100%)', margin: '0 auto' }}>
        <div style={{ marginBottom: '18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Link
            href={`${leagueHome}?tab=stream`}
            style={{ color: '#93c5fd', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
          >
            ← Back to league (Stream tab)
          </Link>
          <Link href={leagueHome} style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}>
            League home
          </Link>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 10px', letterSpacing: '-0.02em' }}>Live stream</h1>
        <p style={{ margin: '0 0 22px', fontSize: '14px', color: '#94a3b8', lineHeight: 1.55 }}>
          Watch-only page for the current live league game. Organizers set stream URLs in{' '}
          <strong style={{ color: '#e2e8f0' }}>Dashboard → League website → Access & streams</strong> (or per team on the public team page).
        </p>

        {live === undefined ? (
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        ) : !live ? (
          <div
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: '16px',
              fontSize: '14px',
              lineHeight: 1.55,
            }}
          >
            No game is live right now.
          </div>
        ) : !live.streamPageUrl?.trim() ? (
          <div
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: '16px',
              fontSize: '14px',
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: '#f8fafc' }}>
              {live.homeName || 'Home'} vs {live.awayName || 'Away'}
            </strong>{' '}
            is live, but no stream URL is set yet. Add a <strong style={{ color: '#f8fafc' }}>league default</strong> or{' '}
            <strong style={{ color: '#f8fafc' }}>per-team</strong> link in{' '}
            <strong style={{ color: '#f8fafc' }}>Dashboard → League website → Access & streams</strong>.
          </div>
        ) : (
          (() => {
            const raw = live.streamPageUrl!.trim()
            let watchUrl: string | null = null
            try {
              const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
              if (u.protocol === 'http:' || u.protocol === 'https:') watchUrl = u.href
            } catch {
              watchUrl = null
            }
            return watchUrl ? (
              <StreamWithOverlay watchUrl={watchUrl} liveGameId={live.gameId} accentColor={accent} />
            ) : (
              <p style={{ color: '#94a3b8' }}>Could not read stream URL.</p>
            )
          })()
        )}
      </div>
    </div>
  )
}
