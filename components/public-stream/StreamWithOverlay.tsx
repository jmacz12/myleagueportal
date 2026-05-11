'use client'

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { streamWatchUrlToEmbedSrc } from '@/lib/stream-embed'

/** Desktop / tablet — band tall enough for sponsor + score row inside the iframe. */
export const STREAM_OVERLAY_BAND_HEIGHT = 'clamp(96px, 14%, 158px)'
/** Phones — shorter than desktop but tall enough that sponsor + score row are not clipped inside the iframe */
export const STREAM_OVERLAY_BAND_HEIGHT_MOBILE = 'clamp(76px, 13%, 124px)'

const MOBILE_MQ = '(max-width: 768px)'

function useMediaFlag(query: string): boolean {
  const getServer = () => false
  const subscribe = (cb: () => void) => {
    if (typeof window === 'undefined') return () => {}
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
  const getSnapshot = () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  }
  return useSyncExternalStore(subscribe, getSnapshot, getServer)
}

type Props = {
  /** Public watch URL (YouTube/Twitch page), same as team stream_url */
  watchUrl: string
  /** When set, iframe loads /games/[id]/overlay for live scores */
  liveGameId: string | null
  accentColor?: string
}

const shellBox: CSSProperties = {
  position: 'relative',
  width: '100%',
  borderRadius: '14px',
  overflow: 'hidden',
  background: '#000',
  aspectRatio: '16 / 9',
  isolation: 'isolate',
}

export function StreamWithOverlay({ watchUrl, liveGameId, accentColor = '#5a7a2a' }: Props) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const isNarrow = useMediaFlag(MOBILE_MQ)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const src = streamWatchUrlToEmbedSrc(watchUrl, window.location.hostname)
    setEmbedSrc(src)
  }, [watchUrl])

  const overlaySrc = useMemo(() => {
    if (!liveGameId) return null
    const q = new URLSearchParams({ embed: '1' })
    if (isNarrow) q.set('compact', '1')
    return `/games/${liveGameId}/overlay?${q}`
  }, [liveGameId, isNarrow])

  const overlayBandHeight = isNarrow ? STREAM_OVERLAY_BAND_HEIGHT_MOBILE : STREAM_OVERLAY_BAND_HEIGHT

  if (!embedSrc) {
    return (
      <div
        style={{
          borderRadius: '14px',
          padding: '20px',
          background: 'rgba(15,23,42,0.06)',
          border: '1px solid rgba(15,23,42,0.12)',
          fontSize: '14px',
          lineHeight: 1.5,
        }}
      >
        This stream link isn&apos;t a supported embed yet. Use a standard YouTube or Twitch watch URL, or{' '}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: accentColor }}>
          open the stream in a new tab
        </a>
        .
      </div>
    )
  }

  return (
    <div>
      <div style={shellBox}>
        <iframe
          title="Live stream"
          src={embedSrc}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: 0,
          }}
        />
        {overlaySrc ? (
          <iframe
            title="Live score overlay"
            src={overlaySrc}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: overlayBandHeight,
              border: 'none',
              pointerEvents: 'none',
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
          />
        ) : null}
      </div>

      <div
        role="note"
        style={{
          marginTop: '14px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(15,23,42,0.12)',
          background: 'rgba(15,23,42,0.04)',
          fontSize: '13px',
          lineHeight: 1.55,
          color: 'rgba(15,23,42,0.82)',
        }}
      >
        <strong style={{ color: 'rgba(15,23,42,0.92)' }}>Fullscreen</strong> — Use the{' '}
        <strong style={{ color: accentColor }}>video player&apos;s own fullscreen</strong> control (usually in the
        player corner) for the largest picture. The <strong>live score strip</strong> on this page only shows
        <em> here</em>; it cannot appear inside YouTube or Twitch fullscreen.
        <br />
        <br />
        <strong style={{ color: 'rgba(15,23,42,0.92)' }}>Phones</strong> — On <strong>iPhone</strong>, every in-app
        browser (Safari, Chrome, Edge, etc.) uses <strong>the same WebKit engine</strong>, so switching browsers does
        <strong> not</strong> change how fullscreen and overlays behave. For the smoothest mix of a big player and
        this score strip, use a <strong>computer</strong> or <strong>Android with Chrome</strong>.
      </div>

      <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'rgba(15,23,42,0.62)', lineHeight: 1.5 }}>
        Play and pause from the video controls.
      </p>
    </div>
  )
}
