'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type PreviewPayload = {
  game: {
    id: string
    home_score: number
    away_score: number
    status: string
    period: number | null
    game_clock: string | null
  }
  organization: { name: string } | null
  homeTeam: { name: string } | null
  awayTeam: { name: string } | null
}

export default function StreamPreviewPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const [payload, setPayload] = useState<PreviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  async function load() {
    const res = await fetch(`/api/public/games/${encodeURIComponent(gameId)}/overlay`)
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.game) {
      setErr(typeof json?.error === 'string' ? json.error : 'Could not load game')
      setLoading(false)
      return
    }
    setPayload(json as PreviewPayload)
    setLoading(false)
  }

  useEffect(() => {
    if (!gameId) return
    void load()
  }, [gameId])

  async function patchGame(updates: Record<string, unknown>) {
    await fetch(`/api/games/${encodeURIComponent(gameId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    await load()
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#020617' }} />
  if (!payload) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', display: 'grid', placeItems: 'center' }}>
        {err || 'Not found'}
      </div>
    )
  }

  const cleanOverlayUrl = `/games/${gameId}/overlay`
  const editableOverlayUrl = `/games/${gameId}/overlay?edit=1`

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '18px' }}>
        <div style={{ marginBottom: '10px', fontWeight: 800, fontSize: '15px' }}>
          Fake stream preview: {payload.homeTeam?.name || 'Home'} vs {payload.awayTeam?.name || 'Away'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px' }}>
          This black canvas simulates a live video feed. Overlay is rendered on top via iframe.
        </div>

        <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.35)' }}>
          <div style={{ aspectRatio: '16 / 9', background: 'linear-gradient(145deg, #020617 0%, #0f172a 100%)', display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{payload.organization?.name || 'League'} live feed</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', marginTop: '6px' }}>FAKE STREAM VIDEO</div>
            </div>
          </div>
          <iframe
            src={cleanOverlayUrl}
            title="Overlay Preview"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: 'transparent' }}
          />
        </div>

        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button type="button" onClick={() => void patchGame({ status: 'live' })}>
            Set Live
          </button>
          <button type="button" onClick={() => void patchGame({ status: 'scheduled' })}>
            Set Scheduled
          </button>
          <button type="button" onClick={() => void patchGame({ status: 'final' })}>
            Set Final
          </button>
          <button type="button" onClick={() => void patchGame({ home_score: (payload.game.home_score || 0) + 1 })}>
            Home +1
          </button>
          <button type="button" onClick={() => void patchGame({ away_score: (payload.game.away_score || 0) + 1 })}>
            Away +1
          </button>
          <button type="button" onClick={() => void patchGame({ period: Math.min(4, (payload.game.period || 1) + 1) })}>
            Next Period
          </button>
          <button type="button" onClick={() => void patchGame({ game_clock: '10:00' })}>
            Reset Clock
          </button>
        </div>

        <div style={{ marginTop: '12px', display: 'grid', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
          <div>
            Overlay URL: <code>{cleanOverlayUrl}</code>
          </div>
          <div>
            Enterprise editor URL: <code>{editableOverlayUrl}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
