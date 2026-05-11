'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { ThemePreset } from '@/lib/leagueTheme'
import type { LeagueSiteMediaItem } from '@/lib/league-site'

const WINDOW = 5

export function MediaGalleryPublic({
  items,
  preset,
}: {
  items: LeagueSiteMediaItem[]
  preset: ThemePreset
}) {
  const images = useMemo(() => items.filter((i) => i.kind === 'image'), [items])
  const videos = useMemo(() => items.filter((i) => i.kind === 'video'), [items])

  const [start, setStart] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const maxStart = Math.max(0, images.length - WINDOW)

  useEffect(() => {
    setStart((s) => Math.min(s, maxStart))
  }, [maxStart, images.length])

  const closeLb = useCallback(() => setLightbox(null), [])

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLb()
      if (e.key === 'ArrowLeft' && lightbox > 0) setLightbox(lightbox - 1)
      if (e.key === 'ArrowRight' && lightbox < images.length - 1) setLightbox(lightbox + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLb, images.length])

  const openAtImageIndex = useCallback((globalIdx: number) => {
    setLightbox(globalIdx)
  }, [])

  return (
    <div>
      {images.length > 0 ? (
        images.length <= WINDOW ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
            {images.map((item, globalIdx) => (
              <figure key={`${item.url}-${globalIdx}`} style={{ margin: 0 }}>
                <button
                  type="button"
                  onClick={() => openAtImageIndex(globalIdx)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'zoom-in',
                    borderRadius: '14px',
                    overflow: 'hidden',
                  }}
                  aria-label={item.caption ? `Zoom: ${item.caption}` : 'Zoom image'}
                >
                  { }
                  <img
                    src={item.url}
                    alt={item.caption || ''}
                    style={{ width: '100%', height: 'min(200px, 28vw)', objectFit: 'cover', display: 'block' }}
                  />
                </button>
                {item.caption ? (
                  <figcaption style={{ fontSize: '12px', color: preset.muted, marginTop: '6px' }}>{item.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                aria-label="Previous photos"
                disabled={start <= 0}
                onClick={() => setStart((s) => Math.max(0, s - 1))}
                style={{
                  flexShrink: 0,
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.surfaceBg,
                  color: preset.heading,
                  cursor: start <= 0 ? 'not-allowed' : 'pointer',
                  opacity: start <= 0 ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${WINDOW}, minmax(0, 1fr))`,
                  gap: '10px',
                  minWidth: 0,
                }}
              >
                {images.slice(start, start + WINDOW).map((item, i) => {
                  const globalIdx = start + i
                  return (
                    <figure key={`${item.url}-${globalIdx}`} style={{ margin: 0, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => openAtImageIndex(globalIdx)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'zoom-in',
                          borderRadius: '12px',
                          overflow: 'hidden',
                        }}
                        aria-label={item.caption ? `Zoom: ${item.caption}` : 'Zoom image'}
                      >
                        { }
                        <img
                          src={item.url}
                          alt={item.caption || ''}
                          style={{
                            width: '100%',
                            aspectRatio: '4 / 3',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </button>
                    </figure>
                  )
                })}
              </div>
              <button
                type="button"
                aria-label="Next photos"
                disabled={start >= maxStart}
                onClick={() => setStart((s) => Math.min(maxStart, s + 1))}
                style={{
                  flexShrink: 0,
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.surfaceBg,
                  color: preset.heading,
                  cursor: start >= maxStart ? 'not-allowed' : 'pointer',
                  opacity: start >= maxStart ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronRight size={22} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: preset.muted, margin: '10px 0 0', textAlign: 'center' }}>
              Showing {start + 1}–{Math.min(start + WINDOW, images.length)} of {images.length} photos · tap a photo to enlarge
            </p>
            {images.slice(start, start + WINDOW).some((it) => it.caption) ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WINDOW}, minmax(0, 1fr))`, gap: '10px', marginTop: '8px' }}>
                {images.slice(start, start + WINDOW).map((item, i) => (
                  <p
                    key={`cap-${start + i}`}
                    style={{ fontSize: '11px', color: preset.muted, margin: 0, textAlign: 'center', lineHeight: 1.35 }}
                  >
                    {item.caption || '\u00a0'}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {videos.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: images.length > 0 ? '16px' : 0,
          }}
        >
          {videos.map((item, i) => (
            <a
              key={`${item.url}-${i}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: preset.accent,
                padding: '12px 14px',
                border: `1px dashed ${preset.surfaceBorder}`,
                borderRadius: '12px',
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Open video {videos.length > 1 ? `(${i + 1})` : ''}
            </a>
          ))}
        </div>
      ) : null}

      {lightbox !== null && images[lightbox] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={closeLb}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              closeLb()
            }}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={24} />
          </button>
          {lightbox > 0 ? (
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation()
                setLightbox(lightbox - 1)
              }}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                border: 'none',
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={28} />
            </button>
          ) : null}
          {lightbox < images.length - 1 ? (
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation()
                setLightbox(lightbox + 1)
              }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                border: 'none',
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={28} />
            </button>
          ) : null}
          <figure
            style={{ margin: 0, maxWidth: 'min(96vw, 1100px)', maxHeight: '90vh', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            { }
            <img
              src={images[lightbox].url}
              alt={images[lightbox].caption || ''}
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '8px',
                display: 'block',
                margin: '0 auto',
              }}
            />
            {images[lightbox].caption ? (
              <figcaption
                style={{
                  marginTop: '14px',
                  textAlign: 'center',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.45,
                }}
              >
                {images[lightbox].caption}
              </figcaption>
            ) : null}
          </figure>
        </div>
      ) : null}
    </div>
  )
}
