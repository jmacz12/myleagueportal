'use client'

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCw,
  Trash2,
} from 'lucide-react'
import type { ThemePreset } from '@/lib/leagueTheme'
import type {
  LeagueSiteContentImage,
  LeagueSiteContentTextPiece,
  LeagueSiteSection,
} from '@/lib/league-site'
import {
  defaultLeagueSiteContentTextPieceLayout,
  syncContentDerivedFields,
} from '@/lib/league-site'

const SNAP_TOLERANCE_PX = 5
const SNAP_GUIDE_GREEN = '#556b3f'

/**
 * Editor canvas min height must NOT use `image.maxHeightPx` — that field is the photo crop cap and
 * changes when dragging the vertical edge handles; tying it to the container made the whole block jump.
 */
export const LEAGUE_SITE_CREATIVE_CANVAS_MIN_HEIGHT = 'min(520px, max(300px, 40vh))' as const

function clampNum(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}

/** Snap canvas-local px to 0 / center / far edge; returns snapped px + whether guide applies */
function snapScalar(px: number, span: number): { px: number; guide: boolean } {
  const targets = [0, span / 2, span]
  for (const t of targets) {
    if (Math.abs(px - t) <= SNAP_TOLERANCE_PX) return { px: t, guide: true }
  }
  return { px, guide: false }
}

type Props = {
  sec: Extract<LeagueSiteSection, { type: 'content' }>
  preset: ThemePreset
  updateSection: (id: string, fn: (s: LeagueSiteSection) => LeagueSiteSection) => void
  pieces: LeagueSiteContentTextPiece[]
}

export function LeagueSiteCreativeBlockCanvas({ sec, preset, updateSection, pieces }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const photoFrameRef = useRef<HTMLDivElement>(null)
  const img = sec.image

  const photoDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origOx: number
    origOy: number
  } | null>(null)
  const rotateDragRef = useRef<{
    pointerId: number
    cx: number
    cy: number
    startRad: number
    startDeg: number
  } | null>(null)
  const edgeResizeRef = useRef<{
    pointerId: number
    edge: 'left' | 'right' | 'top' | 'bottom'
    startClient: number
    startWidthPct: number
    startMaxHeightPx: number
  } | null>(null)
  const textDragRef = useRef<{
    pointerId: number
    pieceId: string
    startClientX: number
    startClientY: number
    origXPct: number
    origYPct: number
  } | null>(null)
  const clickTrackRef = useRef<{ pieceId: string; x: number; y: number; moved: boolean } | null>(null)

  const [photoDragging, setPhotoDragging] = useState(false)
  const [photoDragLive, setPhotoDragLive] = useState<{ ox: number; oy: number } | null>(null)
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null)
  const [snapLines, setSnapLines] = useState<{ vx?: number; hy?: number }>({})
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)

  const displayOx = photoDragLive?.ox ?? img?.offsetX ?? 0
  const displayOy = photoDragLive?.oy ?? img?.offsetY ?? 0

  /** Offset is stored as roughly “% of canvas”; apply via left/top — NOT a second translate() % (that uses the image’s own box and skews pan). */
  const photoPlacementStyle: CSSProperties | undefined = img
    ? {
        position: 'absolute',
        left: `calc(50% + ${displayOx}%)`,
        top: `calc(45% + ${displayOy}%)`,
        width: `${img.widthPct}%`,
        maxWidth: '130%',
        transform: `translate(-50%, -50%) rotate(${img.rotateDeg}deg) scale(${img.scale})`,
        transformOrigin: 'center center',
      }
    : undefined

  const canvasMinH = img ? LEAGUE_SITE_CREATIVE_CANVAS_MIN_HEIGHT : '260px'

  const patchImage = useCallback(
    (fn: (im: LeagueSiteContentImage) => LeagueSiteContentImage) => {
      updateSection(sec.id, (s) => {
        if (s.type !== 'content' || !s.image) return s
        return { ...s, image: fn(s.image) }
      })
    },
    [sec.id, updateSection]
  )

  function patchTextPieces(updater: (cur: LeagueSiteContentTextPiece[]) => LeagueSiteContentTextPiece[]) {
    updateSection(sec.id, (s) => {
      if (s.type !== 'content') return s
      const cur =
        s.textPieces.length > 0 ? [...s.textPieces] : migratePiecesFromLegacy(s)
      const next = updater(cur)
      const { title, body } = syncContentDerivedFields(next)
      return { ...s, textPieces: next, title, body }
    })
  }

  function migratePiecesFromLegacy(s: Extract<LeagueSiteSection, { type: 'content' }>): LeagueSiteContentTextPiece[] {
    const out: LeagueSiteContentTextPiece[] = []
    let i = 0
    if (s.title.trim()) {
      const d = defaultLeagueSiteContentTextPieceLayout(i, 'heading')
      out.push({ id: `${s.id}-h`, role: 'heading', text: s.title, xPct: d.xPct, yPct: d.yPct })
      i++
    }
    if (s.body.trim()) {
      const d = defaultLeagueSiteContentTextPieceLayout(i, 'paragraph')
      out.push({ id: `${s.id}-p`, role: 'paragraph', text: s.body, xPct: d.xPct, yPct: d.yPct })
    }
    return out
  }

  function handlePhotoPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!img || e.button !== 0) return
    photoDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origOx: img.offsetX,
      origOy: img.offsetY,
    }
    setPhotoDragging(true)
    setSnapLines({})
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePhotoPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const session = photoDragRef.current
    const canvas = canvasRef.current
    if (!session || !canvas || !img) return
    if (e.pointerId !== session.pointerId) return
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)
    const sensitivity = 95
    const ox = clampNum(
      session.origOx + ((e.clientX - session.startX) / w) * sensitivity,
      -80,
      80
    )
    const oy = clampNum(
      session.origOy + ((e.clientY - session.startY) / h) * sensitivity,
      -80,
      80
    )
    setPhotoDragLive({ ox, oy })
  }

  function handlePhotoPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const session = photoDragRef.current
    if (session && e.pointerId === session.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const canvas = canvasRef.current
      if (canvas && img) {
        const w = Math.max(1, canvas.clientWidth)
        const h = Math.max(1, canvas.clientHeight)
        const sensitivity = 95
        const ox = clampNum(
          session.origOx + ((e.clientX - session.startX) / w) * sensitivity,
          -80,
          80
        )
        const oy = clampNum(
          session.origOy + ((e.clientY - session.startY) / h) * sensitivity,
          -80,
          80
        )
        updateSection(sec.id, (s) => {
          if (s.type !== 'content' || !s.image) return s
          return { ...s, image: { ...s.image, offsetX: ox, offsetY: oy } }
        })
      }
    }
    photoDragRef.current = null
    setPhotoDragging(false)
    setPhotoDragLive(null)
    setSnapLines({})
  }

  function handleRotatePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!img || !photoFrameRef.current) return
    e.stopPropagation()
    const r = photoFrameRef.current.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const startRad = Math.atan2(e.clientY - cy, e.clientX - cx)
    rotateDragRef.current = {
      pointerId: e.pointerId,
      cx,
      cy,
      startRad,
      startDeg: img.rotateDeg,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleRotatePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const session = rotateDragRef.current
    if (!session || e.pointerId !== session.pointerId || !img) return
    const cur = Math.atan2(e.clientY - session.cy, e.clientX - session.cx)
    const nextDeg = session.startDeg + ((cur - session.startRad) * 180) / Math.PI
    patchImage((im) => ({ ...im, rotateDeg: clampNum(nextDeg, -180, 180) }))
  }

  function handleRotatePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const session = rotateDragRef.current
    if (session && e.pointerId === session.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    rotateDragRef.current = null
  }

  function handleEdgePointerDown(edge: 'left' | 'right' | 'top' | 'bottom', e: ReactPointerEvent<HTMLButtonElement>) {
    if (!img || !canvasRef.current) return
    e.stopPropagation()
    const startClient = edge === 'left' || edge === 'right' ? e.clientX : e.clientY
    edgeResizeRef.current = {
      pointerId: e.pointerId,
      edge,
      startClient,
      startWidthPct: img.widthPct,
      startMaxHeightPx: img.maxHeightPx,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleEdgePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const session = edgeResizeRef.current
    if (!session || e.pointerId !== session.pointerId || !canvasRef.current) return
    const W = Math.max(1, canvasRef.current.clientWidth)
    if (session.edge === 'left' || session.edge === 'right') {
      const delta = e.clientX - session.startClient
      const dPct = (delta / W) * 100 * 0.9
      if (session.edge === 'right') {
        const next = clampNum(session.startWidthPct + dPct, 15, 100)
        patchImage((im) => ({ ...im, widthPct: next }))
      } else {
        const next = clampNum(session.startWidthPct - dPct, 15, 100)
        patchImage((im) => ({ ...im, widthPct: next }))
      }
    } else {
      const delta = e.clientY - session.startClient
      const next = Math.round(clampNum(session.startMaxHeightPx + delta * 1.15, 80, 900))
      patchImage((im) => ({ ...im, maxHeightPx: next }))
    }
  }

  function handleEdgePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const session = edgeResizeRef.current
    if (session && e.pointerId === session.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    edgeResizeRef.current = null
  }

  function handlePhotoWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (!img) return
    e.preventDefault()
    e.stopPropagation()
    const step = e.deltaY > 0 ? -0.07 : 0.07
    patchImage((im) => ({ ...im, scale: clampNum(im.scale + step, 0.2, 4) }))
  }

  const handleStyle: CSSProperties = {
    position: 'absolute',
    width: '30px',
    height: '30px',
    borderRadius: '999px',
    border: `1px solid ${preset.surfaceBorder}`,
    background: 'rgba(255,255,255,0.94)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    color: preset.heading,
    zIndex: 6,
    touchAction: 'none',
  }

  function onTextPointerDown(pieceId: string, xPct: number, yPct: number, e: ReactPointerEvent) {
    if (editingPieceId === pieceId) return
    e.stopPropagation()
    if (e.button !== 0) return
    clickTrackRef.current = { pieceId, x: e.clientX, y: e.clientY, moved: false }
    textDragRef.current = {
      pointerId: e.pointerId,
      pieceId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origXPct: xPct,
      origYPct: yPct,
    }
    setSelectedPieceId(pieceId)
    const el = e.currentTarget as HTMLElement
    if (el.setPointerCapture) el.setPointerCapture(e.pointerId)
  }

  function onTextPointerMove(e: ReactPointerEvent) {
    const drag = textDragRef.current
    const canvas = canvasRef.current
    if (!drag || !canvas || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    if (Math.hypot(dx, dy) > 5) {
      if (clickTrackRef.current) clickTrackRef.current.moved = true
    }
    const cr = canvas.getBoundingClientRect()
    const w = Math.max(1, cr.width)
    const h = Math.max(1, cr.height)
    const px = (drag.origXPct / 100) * w + (e.clientX - drag.startClientX)
    const py = (drag.origYPct / 100) * h + (e.clientY - drag.startClientY)
    const sx = snapScalar(px, w)
    const sy = snapScalar(py, h)
    const nextXPct = clampNum((sx.px / w) * 100, 0, 100)
    const nextYPct = clampNum((sy.px / h) * 100, 0, 100)
    setSnapLines({
      vx: sx.guide ? sx.px : undefined,
      hy: sy.guide ? sy.px : undefined,
    })
    patchTextPieces((cur) =>
      cur.map((p) =>
        p.id === drag.pieceId ? { ...p, xPct: nextXPct, yPct: nextYPct } : p
      )
    )
  }

  function onTextPointerUp(e: ReactPointerEvent) {
    const drag = textDragRef.current
    if (drag && e.pointerId === drag.pointerId) {
      try {
        const el = e.currentTarget as HTMLElement
        if (el.releasePointerCapture) el.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    textDragRef.current = null
    setSnapLines({})
    const track = clickTrackRef.current
    if (track && !track.moved) {
      setEditingPieceId(track.pieceId)
    }
    clickTrackRef.current = null
  }

  function removePiece(id: string) {
    patchTextPieces((cur) => cur.filter((p) => p.id !== id))
    setEditingPieceId((ed) => (ed === id ? null : ed))
    setSelectedPieceId((s) => (s === id ? null : s))
  }

  function updatePieceText(id: string, text: string) {
    patchTextPieces((cur) => cur.map((p) => (p.id === id ? { ...p, text } : p)))
  }

  return (
    <div
      ref={canvasRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: canvasMinH,
        overflow: 'hidden',
        borderRadius: '14px',
        background: preset.surfaceBg,
      }}
    >
      {/* Smart guides */}
      {snapLines.vx !== undefined ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: snapLines.vx,
            top: 0,
            bottom: 0,
            width: 1,
            background: `repeating-linear-gradient(180deg, ${SNAP_GUIDE_GREEN} 0px, ${SNAP_GUIDE_GREEN} 4px, transparent 4px, transparent 8px)`,
            zIndex: 15,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {snapLines.hy !== undefined ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: snapLines.hy,
            left: 0,
            right: 0,
            height: 1,
            background: `repeating-linear-gradient(90deg, ${SNAP_GUIDE_GREEN} 0px, ${SNAP_GUIDE_GREEN} 4px, transparent 4px, transparent 8px)`,
            zIndex: 15,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {img && photoPlacementStyle ? (
        <>
          {/* Image + pan — below text; handles are in a separate layer so they stay clickable */}
          <div style={{ ...photoPlacementStyle, zIndex: 1 }}>
            <div
              ref={photoFrameRef}
              role="presentation"
              aria-label="Drag photo to pan"
              onPointerDown={handlePhotoPointerDown}
              onPointerMove={handlePhotoPointerMove}
              onPointerUp={handlePhotoPointerUp}
              onPointerCancel={handlePhotoPointerUp}
              onWheel={handlePhotoWheel}
              style={{
                position: 'relative',
                cursor: photoDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: img.maxHeightPx,
                  overflow: 'hidden',
                  borderRadius: img.borderRadiusPx,
                  margin: '0 auto',
                }}
              >
                <img
                  src={img.url}
                  alt=""
                  draggable={false}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${img.objectPositionX}% ${img.objectPositionY}%`,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              </div>
            </div>
          </div>
          {/* Same placement + frame height as photo layer; handles sit above text */}
          <div
            style={{
              ...photoPlacementStyle,
              zIndex: 8,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: img.maxHeightPx,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                }}
              >
              <button
                type="button"
                aria-label="Resize width"
                title="Drag"
                onPointerDown={(e) => handleEdgePointerDown('left', e)}
                onPointerMove={handleEdgePointerMove}
                onPointerUp={handleEdgePointerUp}
                onPointerCancel={handleEdgePointerUp}
                style={{
                  ...handleStyle,
                  left: -15,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'ew-resize',
                  borderColor: preset.accent,
                  pointerEvents: 'auto',
                }}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Resize width"
                title="Drag"
                onPointerDown={(e) => handleEdgePointerDown('right', e)}
                onPointerMove={handleEdgePointerMove}
                onPointerUp={handleEdgePointerUp}
                onPointerCancel={handleEdgePointerUp}
                style={{
                  ...handleStyle,
                  right: -15,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'ew-resize',
                  borderColor: preset.accent,
                  pointerEvents: 'auto',
                }}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Resize photo height"
                title="Drag to change photo height"
                onPointerDown={(e) => handleEdgePointerDown('top', e)}
                onPointerMove={handleEdgePointerMove}
                onPointerUp={handleEdgePointerUp}
                onPointerCancel={handleEdgePointerUp}
                style={{
                  ...handleStyle,
                  left: '50%',
                  top: -15,
                  transform: 'translateX(-50%)',
                  cursor: 'ns-resize',
                  borderColor: preset.accent,
                  pointerEvents: 'auto',
                }}
              >
                <ChevronUp size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Resize photo height"
                title="Drag to change photo height"
                onPointerDown={(e) => handleEdgePointerDown('bottom', e)}
                onPointerMove={handleEdgePointerMove}
                onPointerUp={handleEdgePointerUp}
                onPointerCancel={handleEdgePointerUp}
                style={{
                  ...handleStyle,
                  left: '50%',
                  bottom: -15,
                  transform: 'translateX(-50%)',
                  cursor: 'ns-resize',
                  borderColor: preset.accent,
                  pointerEvents: 'auto',
                }}
              >
                <ChevronDown size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Rotate"
                onPointerDown={handleRotatePointerDown}
                onPointerMove={handleRotatePointerMove}
                onPointerUp={handleRotatePointerUp}
                onPointerCancel={handleRotatePointerUp}
                style={{
                  ...handleStyle,
                  right: -15,
                  bottom: -15,
                  cursor: 'grab',
                  borderColor: preset.accent,
                  pointerEvents: 'auto',
                }}
              >
                <RotateCw size={15} aria-hidden />
              </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {pieces.map((p) => {
        const isEditing = editingPieceId === p.id
        const isSel = selectedPieceId === p.id
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.xPct}%`,
              top: `${p.yPct}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              maxWidth: 'min(92%, 520px)',
              width: 'max-content',
              minWidth: 'min(92vw, 280px)',
              pointerEvents: 'none',
            }}
          >
            <div
              onPointerDown={(e) => onTextPointerDown(p.id, p.xPct, p.yPct, e)}
              onPointerMove={onTextPointerMove}
              onPointerUp={onTextPointerUp}
              onPointerCancel={onTextPointerUp}
              style={{
                position: 'relative',
                padding: '8px 10px',
                borderRadius: '12px',
                outline: isSel || isEditing ? `2px solid ${preset.accent}` : 'none',
                background:
                  isEditing || isSel ? `${preset.accentSoftBg}` : 'transparent',
                cursor: isEditing ? 'text' : photoDragging ? 'default' : 'grab',
                boxShadow: isSel && !isEditing ? `0 0 0 1px ${preset.accentMutedBg}` : undefined,
                pointerEvents: 'auto',
              }}
            >
              {isEditing ? (
                p.role === 'heading' ? (
                  <input
                    autoFocus
                    type="text"
                    value={p.text}
                    onChange={(e) => updatePieceText(p.id, e.target.value)}
                    onBlur={() => setEditingPieceId(null)}
                    placeholder="Heading"
                    style={{
                      width: '100%',
                      minWidth: '200px',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 'clamp(18px, 2.2vw, 22px)',
                      fontWeight: 900,
                      color: preset.heading,
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <textarea
                    autoFocus
                    value={p.text}
                    onChange={(e) => updatePieceText(p.id, e.target.value)}
                    onBlur={() => setEditingPieceId(null)}
                    placeholder="Write your message…"
                    rows={5}
                    style={{
                      width: '100%',
                      minWidth: '240px',
                      border: 'none',
                      outline: 'none',
                      resize: 'vertical',
                      background: 'transparent',
                      fontSize: '14px',
                      color: preset.body,
                      lineHeight: 1.65,
                      fontFamily: 'inherit',
                    }}
                  />
                )
              ) : (
                <div
                  style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {p.role === 'heading' ? (
                    <div
                      style={{
                        fontSize: 'clamp(18px, 2.2vw, 22px)',
                        fontWeight: 900,
                        color: preset.heading,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {p.text || (
                        <span style={{ color: preset.muted, fontWeight: 700 }}>Heading</span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '14px',
                        color: preset.body,
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {p.text || (
                        <span style={{ color: preset.muted }}>Body text</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!isEditing ? (
                <button
                  type="button"
                  aria-label="Remove block"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    removePiece(p.id)
                  }}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 26,
                    height: 26,
                    borderRadius: '999px',
                    border: `1px solid ${preset.surfaceBorder}`,
                    background: preset.pageBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#b91c1c',
                    pointerEvents: 'auto',
                    zIndex: 3,
                  }}
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
