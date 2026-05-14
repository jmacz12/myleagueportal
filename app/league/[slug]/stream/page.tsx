'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { LeaguePublicStreamFanBlock } from '@/components/public-stream/LeaguePublicStreamFanBlock'
import { parseJoinStreamLivePayload, type JoinStreamLivePayload } from '@/lib/join-stream-live'
import { resolveThemePreset } from '@/lib/leagueTheme'
import { getPublicThemeInputsForOrg } from '@/lib/public-league-branding'

type HubOrg = {
  plan?: string | null
  primary_color?: string | null
  league_theme_preset?: string | null
  league_appearance_mode?: string | null
}

export default function LeagueWatchStreamPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''

  const streamGameIdParam = useMemo(() => {
    const raw = searchParams.get('game')?.trim()
    if (!raw || raw.length > 64) return null
    if (!/^[\w-]+$/i.test(raw)) return null
    return raw
  }, [searchParams])

  const [hubOrg, setHubOrg] = useState<HubOrg | null>(null)
  const [live, setLive] = useState<JoinStreamLivePayload | null | undefined>(undefined)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`/api/join/${encodeURIComponent(slug)}/hub`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const o = d?.organization
        if (o && typeof o === 'object') setHubOrg(o as HubOrg)
        else setHubOrg(null)
      })
      .catch(() => {
        if (!cancelled) setHubOrg(null)
      })
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
        setLive(parseJoinStreamLivePayload(d?.live))
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
          setLive(parseJoinStreamLivePayload(d?.live))
        })
        .catch(() => {})
    }, 2000)
    return () => window.clearInterval(id)
  }, [slug, live?.gameId])

  const shellPreset = useMemo(() => resolveThemePreset('#5a7a2a', 'portal_original', 'light'), [])

  const preset = useMemo(() => {
    if (!hubOrg) return shellPreset
    const base = getPublicThemeInputsForOrg(hubOrg)
    return resolveThemePreset(base.primaryColor, base.presetId, base.appearanceMode)
  }, [hubOrg, shellPreset])

  const publicStreamBoxLeaguePreset = useMemo(
    () => ({
      surfaceBg: preset.surfaceBg,
      surfaceBorder: preset.surfaceBorder,
      heading: preset.heading,
      body: preset.body,
      muted: preset.muted,
      accent: preset.accent,
      accentSoftBg: preset.accentSoftBg,
      pageBg: preset.pageBg,
    }),
    [preset]
  )

  const leagueHome = slug ? `/league/${encodeURIComponent(slug)}` : '/'
  const leagueStreamTab = slug ? `${leagueHome}?tab=stream` : '/'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: preset.pageBg,
        color: preset.heading,
        padding: '20px 16px 32px',
      }}
    >
      <div style={{ maxWidth: 'min(960px, 100%)', margin: '0 auto' }}>
        <div style={{ marginBottom: '18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Link href={leagueStreamTab} style={{ color: preset.accent, fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
            ← Back to league (Stream tab)
          </Link>
          <Link href={leagueHome} style={{ color: preset.muted, fontSize: '13px', textDecoration: 'none' }}>
            League home
          </Link>
        </div>
        <h1
          style={{
            fontSize: 'clamp(20px, 2.5vw, 24px)',
            fontWeight: 900,
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
            color: preset.heading,
          }}
        >
          Live stream
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: '14px', color: preset.muted, lineHeight: 1.55 }}>
          Watch-only page with the same layout as the league <strong style={{ color: preset.heading }}>Stream</strong> tab: optional video embed plus
          the full <strong style={{ color: preset.heading }}>player stats</strong> block (same data as{' '}
          <strong style={{ color: preset.heading }}>Dashboard → Games → scoring</strong>). Open a specific game with{' '}
          <strong style={{ color: preset.heading }}>?game=</strong> in the URL. Organizers set stream URLs in{' '}
          <strong style={{ color: preset.heading }}>Dashboard → League website → Access & streams</strong> or per team under{' '}
          <strong style={{ color: preset.heading }}>Manage team → Page & links</strong>.
        </p>

        {live === undefined ? (
          <p style={{ color: preset.muted }}>Loading…</p>
        ) : (
          <LeaguePublicStreamFanBlock
            slug={slug}
            streamGameIdParam={streamGameIdParam}
            streamLive={live}
            leaguePreset={publicStreamBoxLeaguePreset}
          />
        )}
      </div>
    </div>
  )
}
