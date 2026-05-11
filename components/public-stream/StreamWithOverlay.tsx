'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { streamWatchUrlToEmbedSrc } from '@/lib/stream-embed'

/** Desktop / tablet — band tall enough for sponsor + score row inside the iframe. */
export const STREAM_OVERLAY_BAND_HEIGHT = 'clamp(96px, 14%, 158px)'
/** Phones — slimmer strip so more room stays on the actual stream */
export const STREAM_OVERLAY_BAND_HEIGHT_MOBILE = 'clamp(36px, 6.5%, 82px)'

const MOBILE_MQ = '(max-width: 768px)'
const PORTRAIT_MQ = '(orientation: portrait)'

function tryLockLandscape(): void {
  try {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (type: string) => Promise<void>
    }
    if (typeof so?.lock === 'function') void so.lock('landscape').catch(() => {})
  } catch {
    /* unsupported */
  }
}

function tryUnlockOrientation(): void {
  try {
    screen.orientation?.unlock?.()
  } catch {
    /* */
  }
}

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

/** Brand-accent diagonal into deep slate — works everywhere (no color-mix). */
function fullscreenButtonBackground(accentHex: string): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(accentHex) ? accentHex : '#5a7a2a'
  return `linear-gradient(135deg, ${safe} 0%, #1e293b 55%, #020617 100%)`
}

type FsCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

async function requestFullscreenBestEffort(el: HTMLElement): Promise<void> {
  const w = el as FsCapableElement
  if (typeof el.requestFullscreen === 'function') {
    await el.requestFullscreen()
    return
  }
  if (typeof w.webkitRequestFullscreen === 'function') {
    await Promise.resolve(w.webkitRequestFullscreen())
    return
  }
  throw new Error('fullscreen-unavailable')
}

async function exitFullscreenBestEffort(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void
    webkitFullscreenElement?: Element | null
  }
  if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
    await Promise.resolve(doc.webkitExitFullscreen())
    return
  }
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    await document.exitFullscreen()
    return
  }
}

export function StreamWithOverlay({ watchUrl, liveGameId, accentColor = '#5a7a2a' }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const hadNativeFsRef = useRef(false)
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const [fs, setFs] = useState(false)
  /** iOS / Safari often blocks element fullscreen — fixed viewport overlay instead */
  const [immersive, setImmersive] = useState(false)
  const isNarrow = useMediaFlag(MOBILE_MQ)
  const isPortrait = useMediaFlag(PORTRAIT_MQ)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const src = streamWatchUrlToEmbedSrc(watchUrl, window.location.hostname)
    setEmbedSrc(src)
  }, [watchUrl])

  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    const sync = () => {
      const active =
        (document.fullscreenElement === el || doc.webkitFullscreenElement === el) ?? false
      if (hadNativeFsRef.current && !active) tryUnlockOrientation()
      hadNativeFsRef.current = active
      setFs(active)
      if (active) tryLockLandscape()
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!immersive || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [immersive])

  useEffect(() => () => tryUnlockOrientation(), [])

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current
    if (!el) return
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    const inNativeFs = document.fullscreenElement === el || doc.webkitFullscreenElement === el

    if (inNativeFs) {
      await exitFullscreenBestEffort()
      tryUnlockOrientation()
      return
    }
    if (immersive) {
      setImmersive(false)
      tryUnlockOrientation()
      return
    }

    /** Must run in the same synchronous tap turn as the click — before any await — or browsers ignore lock */
    tryLockLandscape()

    try {
      await requestFullscreenBestEffort(el)
    } catch {
      setImmersive(true)
    }
  }, [immersive])

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

  const btnGradient = fullscreenButtonBackground(accentColor)
  const displayFs = fs || immersive

  /** Immersive: largest 16:9 rect inside measured region (container queries → reliable on iOS; vw/min math was undersizing) */
  const shellStyle: CSSProperties = immersive
    ? {
        position: 'relative',
        isolation: 'isolate',
        background: '#000',
        overflow: 'hidden',
        borderRadius: '10px',
        flexShrink: 0,
        margin: '0 auto',
        width: 'min(100cqw, calc(100cqh * 16 / 9))',
        maxHeight: '100cqh',
        aspectRatio: '16 / 9',
      }
    : {
        position: 'relative',
        width: '100%',
        borderRadius: '14px',
        overflow: 'hidden',
        background: '#000',
        aspectRatio: '16 / 9',
        isolation: 'isolate',
      }

  const immersiveExitBtn: CSSProperties = {
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top) + 10px)',
    right: 'calc(env(safe-area-inset-right) + 12px)',
    zIndex: 2147483001,
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.28)',
    boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
    background: btnGradient,
    color: '#f8fafc',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  }

  return (
    <div
      style={
        immersive
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 2147483000,
              background: '#000',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: '-webkit-fill-available',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
              boxSizing: 'border-box',
            }
          : undefined
      }
    >
      {immersive ? (
        <button
          type="button"
          aria-label="Exit full screen"
          onClick={() => void toggleFullscreen()}
          style={immersiveExitBtn}
        >
          <Minimize2 size={24} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}

      <div
        style={
          immersive
            ? {
                containerType: 'size',
                flex: '1 1 0',
                minHeight: 0,
                height: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'calc(env(safe-area-inset-top) + 56px) 10px 10px',
                boxSizing: 'border-box',
                minWidth: 0,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        <div ref={shellRef} style={shellStyle}>
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
      </div>

      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        aria-label={displayFs ? 'Exit full screen' : 'Full screen with overlay'}
        style={{
          display: immersive ? 'none' : 'inline-flex',
          marginTop: '14px',
          width: '100%',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          minHeight: '54px',
          padding: '16px 22px',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 10px 32px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
          background: btnGradient,
          color: '#f8fafc',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '15px',
          fontWeight: 800,
          letterSpacing: '0.02em',
          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
        }}
      >
        {displayFs ? <Minimize2 size={22} strokeWidth={2.25} aria-hidden /> : <Maximize2 size={22} strokeWidth={2.25} aria-hidden />}
        <span>{displayFs ? 'Exit full screen' : 'Full screen with overlay'}</span>
      </button>

      {!immersive ? (
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'rgba(15,23,42,0.72)', lineHeight: 1.55 }}>
          Use the video&apos;s own controls to play or pause.{' '}
          <strong style={{ color: 'rgba(15,23,42,0.88)' }}>Full screen with overlay</strong> enlarges the stream and live scores together.
        </p>
      ) : null}

      {immersive && isPortrait && isNarrow ? (
        <p
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
            zIndex: 2147483001,
            margin: 0,
            fontSize: '12px',
            lineHeight: 1.4,
            color: 'rgba(248,250,252,0.8)',
            textAlign: 'center',
            pointerEvents: 'none',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}
        >
          Turn your phone sideways for the largest picture — iOS Safari can&apos;t auto-rotate the page.
        </p>
      ) : null}
    </div>
  )
}
