'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { StreamWithOverlay } from '@/components/public-stream/StreamWithOverlay'
import { LeagueWatchScoreStrip } from '@/components/public-stream/LeagueWatchScoreStrip'

type StreamLive = {
  gameId: string
  streamPageUrl: string | null
  homeName: string | null
  awayName: string | null
  homeScore: number | null
  awayScore: number | null
  status: string | null
  period: number | null
  gameClock: string | null
  location: string | null
} | null

function normalizeStreamLive(raw: unknown): StreamLive {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.gameId !== 'string') return null
  return {
    gameId: o.gameId,
    streamPageUrl: typeof o.streamPageUrl === 'string' ? o.streamPageUrl : null,
    homeName: typeof o.homeName === 'string' ? o.homeName : null,
    awayName: typeof o.awayName === 'string' ? o.awayName : null,
    homeScore: typeof o.homeScore === 'number' ? o.homeScore : null,
    awayScore: typeof o.awayScore === 'number' ? o.awayScore : null,
    status: typeof o.status === 'string' ? o.status : null,
    period: typeof o.period === 'number' ? o.period : null,
    gameClock: typeof o.gameClock === 'string' ? o.gameClock : null,
    location: typeof o.location === 'string' ? o.location : null,
  }
}

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
        setLive(normalizeStreamLive(d?.live))
      })
      .catch(() => {
        if (!cancelled) setLive(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug || !live?.gameId) return
    const id = window.setInterval(() => {
      fetch(`/api/join/${encodeURIComponent(slug)}/stream`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          setLive(normalizeStreamLive(d?.live))
        })
        .catch(() => {})
    }, 2000)
    return () => window.clearInterval(id)
  }, [slug, live?.gameId])

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
          Watch-only page for the current live league game. Scores update every few seconds below the player. Organizers set stream URLs in{' '}
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
          <>
            <LeagueWatchScoreStrip
              slug={slug}
              gameId={live.gameId}
              homeName={live.homeName}
              awayName={live.awayName}
              homeScore={live.homeScore}
              awayScore={live.awayScore}
              period={live.period}
              gameClock={live.gameClock}
              location={live.location}
              marginTopPx={0}
            />
            <div
              style={{
                marginTop: '14px',
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
          </>
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
              <>
                <StreamWithOverlay watchUrl={watchUrl} liveGameId={live.gameId} accentColor={accent} />
                <LeagueWatchScoreStrip
                  slug={slug}
                  gameId={live.gameId}
                  homeName={live.homeName}
                  awayName={live.awayName}
                  homeScore={live.homeScore}
                  awayScore={live.awayScore}
                  period={live.period}
                  gameClock={live.gameClock}
                  location={live.location}
                />
              </>
            ) : (
              <>
                <LeagueWatchScoreStrip
                  slug={slug}
                  gameId={live.gameId}
                  homeName={live.homeName}
                  awayName={live.awayName}
                  homeScore={live.homeScore}
                  awayScore={live.awayScore}
                  period={live.period}
                  gameClock={live.gameClock}
                  location={live.location}
                  marginTopPx={0}
                />
                <p style={{ marginTop: '12px', color: '#94a3b8' }}>Could not read stream URL.</p>
              </>
            )
          })()
        )}
      </div>
    </div>
  )
}
