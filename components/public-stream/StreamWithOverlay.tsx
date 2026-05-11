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

const MOBILE_CONTROLS_MQ = '(max-width: 640px)'

export function StreamWithOverlay({ watchUrl, liveGameId, accentColor = '#5a7a2a' }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const [fs, setFs] = useState(false)
  const [useMobileChrome, setUseMobileChrome] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const src = streamWatchUrlToEmbedSrc(watchUrl, window.location.hostname)
    setEmbedSrc(src)
  }, [watchUrl])

  /** Duplicate fullscreen control below the player on narrow screens — avoids iframe / sticky-header eating top-right taps (esp. iOS). */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(MOBILE_CONTROLS_MQ)
    const apply = () => setUseMobileChrome(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

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
          isolation: 'isolate',
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
            pointerEvents: 'auto',
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

        {/* Top-right control (desktop / large tablets). No pointer-events:none parent — iOS can drop touches to children. */}
        {!useMobileChrome ? (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '52%',
                minHeight: 120,
                zIndex: 5,
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `max(10px, env(safe-area-inset-top, 0px))`,
                right: `max(10px, env(safe-area-inset-right, 0px))`,
                zIndex: 50,
                pointerEvents: 'auto',
              }}
            >
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                title={fs ? 'Exit full screen' : 'Full screen — video and score overlay'}
                aria-label={fs ? 'Exit full screen' : 'Full screen with overlay'}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'rgba(255,255,255,0.2)',
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
          </>
        ) : null}
      </div>

      {useMobileChrome ? (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={fs ? 'Exit full screen' : 'Full screen with overlay'}
          style={{
            marginTop: '12px',
            width: '100%',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'rgba(0,0,0,0.08)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            minHeight: '52px',
            padding: '14px 18px',
            borderRadius: '12px',
            border: `2px solid ${accentColor}`,
            background: 'rgba(15,23,42,0.92)',
            color: '#f8fafc',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '15px',
            fontWeight: 800,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {fs ? <Minimize2 size={22} strokeWidth={2.25} aria-hidden /> : <Maximize2 size={22} strokeWidth={2.25} aria-hidden />}
          {fs ? 'Exit full screen' : 'Full screen — video and scores'}
        </button>
      ) : null}

      <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'rgba(15,23,42,0.72)', lineHeight: 1.5 }}>
        Use the video&apos;s own controls to play or pause.
        {useMobileChrome
          ? ' Tap the button below to go full screen with the score strip.'
          : ' Tap Full screen (top-right) to enlarge the video and score strip together.'}
      </p>
    </div>
  )
}
