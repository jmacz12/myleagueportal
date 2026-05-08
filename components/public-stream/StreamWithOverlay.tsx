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

const CHROME_HIDE_MS = 4200
const CHROME_HIDE_AFTER_LEAVE_MS = 2200
const POINTER_MOVE_THROTTLE_MS = 85
const INTERACTION_HIDE_AFTER_MS = 3400

export function StreamWithOverlay({ watchUrl, liveGameId, accentColor = '#5a7a2a' }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const [fs, setFs] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerInInteractionZoneRef = useRef(false)
  const moveThrottleRef = useRef(0)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(
    (ms: number) => {
      clearHideTimer()
      hideTimerRef.current = setTimeout(() => setChromeVisible(false), ms)
    },
    [clearHideTimer]
  )

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

  /** Auto-hide fullscreen chrome shortly after load (unless pointer already in interaction zone). */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!pointerInInteractionZoneRef.current) setChromeVisible(false)
    }, CHROME_HIDE_MS)
    return () => clearTimeout(t)
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

  const revealChrome = useCallback(() => {
    setChromeVisible(true)
    clearHideTimer()
  }, [clearHideTimer])

  const bumpChromeFromPointer = useCallback(() => {
    revealChrome()
    scheduleHide(INTERACTION_HIDE_AFTER_MS)
  }, [revealChrome, scheduleHide])

  const onInteractionEnter = useCallback(() => {
    pointerInInteractionZoneRef.current = true
    revealChrome()
  }, [revealChrome])

  const onInteractionLeave = useCallback(() => {
    pointerInInteractionZoneRef.current = false
    scheduleHide(CHROME_HIDE_AFTER_LEAVE_MS)
  }, [scheduleHide])

  /** When pointer moves anywhere over the player shell, show chrome (helps when iframe doesn't bubble). */
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const shell = shellRef.current
      if (!shell) return
      const r = shell.getBoundingClientRect()
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!inside) return
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (now - moveThrottleRef.current < POINTER_MOVE_THROTTLE_MS) return
      moveThrottleRef.current = now
      bumpChromeFromPointer()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [bumpChromeFromPointer])

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

        {/*
          YouTube/Twitch iframes don't bubble pointer events to this page. This transparent layer
          covers the lower portion of the player so hover / touch reliably reveals fullscreen chrome.
        */}
        <div
          onPointerEnter={onInteractionEnter}
          onPointerLeave={onInteractionLeave}
          onPointerMove={() => bumpChromeFromPointer()}
          onTouchStart={() => bumpChromeFromPointer()}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '52%',
            minHeight: 148,
            zIndex: 4,
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            background: 'transparent',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              opacity: chromeVisible ? 1 : 0,
              transition: 'opacity 0.35s ease',
              pointerEvents: chromeVisible ? 'auto' : 'none',
              zIndex: 2,
            }}
          >
            <span
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(248,250,252,0.88)',
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                userSelect: 'none',
                lineHeight: 1.2,
                maxHeight: 120,
              }}
            >
              Fullscreen with overlay
            </span>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              title={fs ? 'Exit full screen' : 'Full screen — video and score overlay'}
              aria-label={fs ? 'Exit full screen' : 'Full screen with overlay'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                flexShrink: 0,
                padding: 0,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(15,23,42,0.88)',
                color: '#f8fafc',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
              }}
            >
              {fs ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: '12px', opacity: 0.75, lineHeight: 1.45 }}>
        {liveGameId
          ? 'Touch or move the pointer over the lower part of the player to show fullscreen controls. The score overlay stays on the stream.'
          : 'Score overlay appears here when this team has a game marked live in the league scorer.'}
      </p>
    </div>
  )
}
