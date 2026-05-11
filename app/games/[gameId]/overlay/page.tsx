'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'
import { rgba } from '@/lib/overlay-theme'

type OverlayPayload = {
  game: {
    id: string
    home_score: number
    away_score: number
    status: string
    period: number | null
    game_clock: string | null
  }
  organization: {
    id: string
    name: string
    plan: string | null
    primary_color: string | null
  } | null
  homeTeam: { id: string; name: string; color: string | null; logo_url: string | null } | null
  awayTeam: { id: string; name: string; color: string | null; logo_url: string | null } | null
}

type OverlayConfig = {
  position: 'top' | 'bottom'
  sponsorText: string
  showSponsor: boolean
  compact: boolean
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_CONFIG: OverlayConfig = {
  position: 'bottom',
  sponsorText: 'Presented by MyLeaguePortal',
  showSponsor: true,
  compact: false,
}

function configStorageKey(gameId: string) {
  return `overlay-config:${gameId}`
}

export default function LiveGameOverlayPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const [payload, setPayload] = useState<OverlayPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canEditOverlay, setCanEditOverlay] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [cfg, setCfg] = useState<OverlayConfig>(DEFAULT_CONFIG)
  const [isEmbed, setIsEmbed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsEmbed(new URLSearchParams(window.location.search).get('embed') === '1')
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/games/${encodeURIComponent(gameId)}/overlay`, {
      cache: 'no-store',
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.game) {
      setError(typeof json?.error === 'string' ? json.error : 'Could not load overlay data')
      setLoading(false)
      return
    }
    setPayload(json as OverlayPayload)
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    if (!gameId) return
    void load()
    const channel = supabase
      .channel(`overlay-game-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => void load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_game_stats', filter: `game_id=eq.${gameId}` },
        () => void load()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, load])

  /** While live: poll ~every second so clock/score stay aligned with the scorer (realtime can miss rows). */
  useEffect(() => {
    if (!gameId || !payload?.game) return
    if (payload.game.status !== 'live') return
    const POLL_MS = 1000
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [gameId, payload?.game?.id, payload?.game?.status, load]) // eslint-disable-line react-hooks/exhaustive-deps -- omit full payload.game so polling is not restarted every score tick

  useEffect(() => {
    if (!payload) return
    const plan = String(payload.organization?.plan || 'basic').toLowerCase()
    const proLike = plan === 'pro' || plan === 'enterprise'
    const enterprise = plan === 'enterprise'
    const q = new URLSearchParams(window.location.search)
    const requestedEdit = q.get('edit') === '1'
    setEditMode(requestedEdit)
    setCanEditOverlay(enterprise)

    const nextCfg: OverlayConfig = {
      position: q.get('position') === 'top' ? 'top' : 'bottom',
      sponsorText: q.get('sponsor') || DEFAULT_CONFIG.sponsorText,
      showSponsor: q.get('s') !== '0',
      compact: q.get('compact') === '1',
    }
    if (enterprise) {
      const saved = localStorage.getItem(configStorageKey(gameId))
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<OverlayConfig>
          if (parsed.position === 'top' || parsed.position === 'bottom') nextCfg.position = parsed.position
          if (typeof parsed.sponsorText === 'string') nextCfg.sponsorText = parsed.sponsorText
          if (typeof parsed.showSponsor === 'boolean') nextCfg.showSponsor = parsed.showSponsor
          if (typeof parsed.compact === 'boolean') nextCfg.compact = parsed.compact
        } catch {
          // ignore malformed saved preset
        }
      }
    }
    if (!proLike) nextCfg.showSponsor = false
    setCfg(nextCfg)
  }, [payload, gameId])

  const plan = useMemo(() => String(payload?.organization?.plan || 'basic').toLowerCase(), [payload])
  const proLike = plan === 'pro' || plan === 'enterprise'
  const accent = payload?.organization?.primary_color || '#5a7a2a'
  const isLive = payload?.game?.status === 'live'

  function pushConfigUrl(next: OverlayConfig) {
    const u = new URL(window.location.href)
    u.searchParams.set('position', next.position)
    u.searchParams.set('s', next.showSponsor ? '1' : '0')
    u.searchParams.set('compact', next.compact ? '1' : '0')
    if (next.sponsorText.trim()) u.searchParams.set('sponsor', next.sponsorText.trim())
    else u.searchParams.delete('sponsor')
    window.history.replaceState(null, '', u.toString())
  }

  function savePreset(next: OverlayConfig) {
    if (!gameId) return
    localStorage.setItem(configStorageKey(gameId), JSON.stringify(next))
  }

  function applyAndPersist(next: OverlayConfig) {
    setCfg(next)
    pushConfigUrl(next)
    if (canEditOverlay) savePreset(next)
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'transparent' }} />
  }
  if (error || !payload) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
        {error || 'Not found'}
      </div>
    )
  }

  const homeTint = payload.homeTeam?.color || accent
  const awayTint = payload.awayTeam?.color || accent
  /** Muted accents — esports-inspired but subtle (not neon). */
  const wingHomeBg = `linear-gradient(105deg, ${rgba(homeTint, 0.14)} 0%, rgba(17, 24, 39, 0.88) 55%)`
  const wingAwayBg = `linear-gradient(-105deg, ${rgba(awayTint, 0.14)} 0%, rgba(17, 24, 39, 0.88) 55%)`
  const centerBg = 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.92) 100%)'
  const nameSize = isEmbed ? (cfg.compact ? 11 : 12) : cfg.compact ? 13 : 15
  const scoreSize = isEmbed ? (cfg.compact ? 20 : 24) : cfg.compact ? 26 : 30
  const metaSize = isEmbed ? 9 : 11
  const logoPx = isEmbed ? 22 : 28
  const edge = isEmbed ? 6 : 16
  const bottomPad = isEmbed ? 4 : 14
  const brandingLabel =
    proLike && cfg.showSponsor && cfg.sponsorText.trim()
      ? cfg.sponsorText
      : 'Presented by MyLeaguePortal'

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      {editMode ? (
        <div
          style={{
            position: 'fixed',
            top: '18px',
            right: '18px',
            width: '300px',
            zIndex: 30,
            background: 'rgba(15,23,42,0.94)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '12px',
            padding: '12px',
            color: '#e2e8f0',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>Overlay editor</div>
          {!canEditOverlay ? (
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>
              Overlay editing is Enterprise-only. Pro still gets the live score overlay.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '12px' }}>
                Position
                <select
                  value={cfg.position}
                  onChange={(e) => {
                    const position: OverlayConfig['position'] =
                      e.target.value === 'top' ? 'top' : 'bottom'
                    const next: OverlayConfig = { ...cfg, position }
                    applyAndPersist(next)
                  }}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="bottom">Bottom</option>
                  <option value="top">Top</option>
                </select>
              </label>
              <label style={{ fontSize: '12px' }}>
                Sponsor text
                <input
                  value={cfg.sponsorText}
                  onChange={(e) => {
                    const next = { ...cfg, sponsorText: e.target.value }
                    applyAndPersist(next)
                  }}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={cfg.showSponsor}
                  onChange={(e) => {
                    const next = { ...cfg, showSponsor: e.target.checked }
                    applyAndPersist(next)
                  }}
                />
                Show sponsor row
              </label>
              <label style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={cfg.compact}
                  onChange={(e) => {
                    const next = { ...cfg, compact: e.target.checked }
                    applyAndPersist(next)
                  }}
                />
                Compact mode
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => savePreset(cfg)} style={{ marginTop: '4px', fontSize: '12px' }}>
                  Save preset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(configStorageKey(gameId))
                    applyAndPersist(DEFAULT_CONFIG)
                  }}
                  style={{ marginTop: '4px', fontSize: '12px' }}
                >
                  Reset preset
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const u = new URL(window.location.href)
                  u.searchParams.delete('edit')
                  navigator.clipboard.writeText(u.toString())
                }}
                style={{ marginTop: '4px', fontSize: '12px' }}
              >
                Copy clean overlay URL
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div
        style={{
          position: 'fixed',
          left: edge,
          right: edge,
          [cfg.position]: bottomPad,
          zIndex: 20,
          maxWidth: isEmbed ? 'min(98vw, 640px)' : 'min(96vw, 760px)',
          marginLeft: 'auto',
          marginRight: 'auto',
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          filter: 'drop-shadow(0 10px 28px rgba(0, 0, 0, 0.45))',
        }}
      >
        <div
          style={{
            borderRadius: isEmbed ? 10 : 14,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Sponsor / brand — always on top */}
          <div
            style={{
              padding: isEmbed ? '5px 10px' : '5px 14px',
              textAlign: 'center',
              fontSize: isEmbed ? 9 : 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'rgba(2, 6, 23, 0.78)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(248, 250, 252, 0.88)',
            }}
          >
            {brandingLabel}
          </div>

          {/* Esports-style row: angled wings + center score block (muted colors) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              minHeight: isEmbed ? 46 : 56,
              background: 'rgba(15, 23, 42, 0.82)',
            }}
          >
            {/* Home wing */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: wingHomeBg,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: isEmbed ? 6 : 8,
                padding: isEmbed ? '6px 18px 6px 10px' : '10px 22px 10px 14px',
                borderBottom: `3px solid ${rgba(homeTint, 0.35)}`,
              }}
            >
              {payload.homeTeam?.logo_url ? (
                 
                <img
                  src={payload.homeTeam.logo_url}
                  alt=""
                  style={{
                    width: logoPx,
                    height: logoPx,
                    borderRadius: Math.max(6, Math.floor(logoPx / 5)),
                    objectFit: 'cover',
                    flexShrink: 0,
                    opacity: 0.92,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
                  }}
                />
              ) : null}
              <span
                style={{
                  fontSize: nameSize,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'rgba(248,250,252,0.94)',
                }}
              >
                {payload.homeTeam?.name || 'Home'}
              </span>
            </div>

            {/* Center score block */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isEmbed ? '6px 14px' : '8px 18px',
                background: centerBg,
                borderLeft: '1px solid rgba(255,255,255,0.07)',
                borderRight: '1px solid rgba(255,255,255,0.07)',
                clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)',
                marginLeft: -6,
                marginRight: -6,
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isEmbed ? 8 : 12,
                }}
              >
                <span
                  style={{
                    fontSize: scoreSize,
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'rgba(248,250,252,0.98)',
                    minWidth: '1.1em',
                    textAlign: 'center',
                  }}
                >
                  {payload.game.home_score ?? 0}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 2,
                    height: `${Math.max(14, Math.round(scoreSize * 0.52))}px`,
                    background: `linear-gradient(180deg, ${rgba(homeTint, 0.5)}, ${rgba(awayTint, 0.5)})`,
                    borderRadius: 2,
                    opacity: 0.75,
                  }}
                />
                <span
                  style={{
                    fontSize: scoreSize,
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'rgba(248,250,252,0.98)',
                    minWidth: '1.1em',
                    textAlign: 'center',
                  }}
                >
                  {payload.game.away_score ?? 0}
                </span>
              </div>
              <div
                style={{
                  fontSize: metaSize,
                  color: 'rgba(203, 213, 225, 0.88)',
                  marginTop: 2,
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                }}
              >
                {isLive ? 'LIVE · ' : ''}
                Q{payload.game.period || 1} · {payload.game.game_clock || '10:00'}
              </div>
            </div>

            {/* Away wing */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: wingAwayBg,
                clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: isEmbed ? 6 : 8,
                padding: isEmbed ? '6px 10px 6px 18px' : '10px 14px 10px 22px',
                borderBottom: `3px solid ${rgba(awayTint, 0.35)}`,
              }}
            >
              <span
                style={{
                  fontSize: nameSize,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'rgba(248,250,252,0.94)',
                }}
              >
                {payload.awayTeam?.name || 'Away'}
              </span>
              {payload.awayTeam?.logo_url ? (
                 
                <img
                  src={payload.awayTeam.logo_url}
                  alt=""
                  style={{
                    width: logoPx,
                    height: logoPx,
                    borderRadius: Math.max(6, Math.floor(logoPx / 5)),
                    objectFit: 'cover',
                    flexShrink: 0,
                    opacity: 0.92,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
