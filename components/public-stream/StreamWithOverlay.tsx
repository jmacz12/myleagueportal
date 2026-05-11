'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
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
  const [embedSrc, setEmbedSrc] = useState<string | null>(null)
  const [fs, setFs] = useState(false)
  /** iOS / Safari often blocks element fullscreen — fixed viewport overlay instead */
  const [immersive, setImmersive] = useState(false)

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
      setFs(active)
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

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current
    if (!el) return
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    const inNativeFs = document.fullscreenElement === el || doc.webkitFullscreenElement === el

    if (inNativeFs) {
      await exitFullscreenBestEffort()
      return
    }
    if (immersive) {
      setImmersive(false)
      return
    }

    try {
      await requestFullscreenBestEffort(el)
    } catch {
      setImmersive(true)
    }
  }, [immersive])

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
  const btnGradient = fullscreenButtonBackground(accentColor)
  const displayFs = fs || immersive

  const shellStyle: CSSProperties = immersive
    ? {
        position: 'relative',
        isolation: 'isolate',
        background: '#000',
        overflow: 'hidden',
        borderRadius: '12px',
        width:
          'min(calc(100vw - 24px), calc((100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 116px) * 16 / 9))',
        aspectRatio: '16 / 9',
        maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 116px)',
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
              paddingTop: 'env(safe-area-inset-top)',
              paddingRight: 'env(safe-area-inset-right)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
            }
          : undefined
      }
    >
      <div
        style={
          immersive
            ? {
                flex: 1,
                minHeight: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                height: STREAM_OVERLAY_BAND_HEIGHT,
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
          marginTop: immersive ? '12px' : '14px',
          width: '100%',
          flexShrink: immersive ? 0 : undefined,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          display: 'inline-flex',
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
    </div>
  )
}
