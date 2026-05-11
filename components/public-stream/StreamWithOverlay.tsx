'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { streamWatchUrlToEmbedSrc } from '@/lib/stream-embed'

/** Must fit sponsor strip + score row inside the overlay iframe (iframe clips overflow). */
export const STREAM_OVERLAY_BAND_HEIGHT = 'clamp(96px, 14%, 158px)'

type Props = {
  /** Public watch URL (YouTube/Twitch page), same as team stream_url */
  watchUrl: string
  /** When set, iframe loads /games/[id]/overlay for live scores */
  liveGameId: string | null
  accentColor?: string
}

/** Large tap target; sits top-right so YouTube/Twitch native controls stay usable at the bottom. */
const FULLSCREEN_BTN_SIZE = 52

export function StreamWithOverlay({ watchUrl, liveGameId, accentColor = '#5a7a2a' }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const [fs, setFs] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const src = streamWatchUrlToEmbedSrc(watchUrl, window.location.hostname)
    setEmbedSrc(src)
  }, [watchUrl])

  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    const onFs = () => setFs(!!document.fullscreenElement && document.fullscreenElement === el)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current
    if (!el) return
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      /* ignore — some browsers block without gesture */
    }
  }, [])

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

  const overlaySrc = liveGameId ? `/games/${liveGameId}/overlay?embed=1` : null

  return (
    <div>
      <div
        ref={shellRef}
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: '14px',
          overflow: 'hidden',
          background: '#000',
          aspectRatio: '16 / 9',
        }}
      >
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
              height: STREAM_OVERLAY_BAND_HEIGHT,
              border: 'none',
              pointerEvents: 'none',
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
          />
        ) : null}

        {/* Top chrome only: does not cover the bottom of the player where embed play/pause lives. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 8,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '10px 10px 48px',
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)',
          }}
        >
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            title={fs ? 'Exit full screen' : 'Full screen — video and score overlay'}
            aria-label={fs ? 'Exit full screen' : 'Full screen with overlay'}
            style={{
              pointerEvents: 'auto',
              touchAction: 'manipulation',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minWidth: FULLSCREEN_BTN_SIZE,
              minHeight: FULLSCREEN_BTN_SIZE,
              padding: '0 14px',
              borderRadius: '12px',
              border: '2px solid rgba(255,255,255,0.45)',
              background: 'rgba(15,23,42,0.92)',
              color: '#f8fafc',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: 800,
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            }}
          >
            {fs ? <Minimize2 size={22} strokeWidth={2.25} aria-hidden /> : <Maximize2 size={22} strokeWidth={2.25} aria-hidden />}
            <span style={{ maxWidth: '120px', lineHeight: 1.15, textAlign: 'left' }}>{fs ? 'Exit' : 'Full screen'}</span>
          </button>
        </div>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'rgba(15,23,42,0.72)', lineHeight: 1.5 }}>
        Use the video&apos;s own controls to play or pause. Tap <strong>Full screen</strong> (top-right) to enlarge the video and score strip together.
      </p>
    </div>
  )
}
