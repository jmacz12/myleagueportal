'use client'

import { useEffect, type ReactNode } from 'react'
import { BookOpen, X } from 'lucide-react'

export type DashboardHelpDialogProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  titleId: string
  children: ReactNode
  maxWidth?: number
}

export function DashboardHelpDialog({
  open,
  onClose,
  title,
  subtitle,
  titleId,
  children,
  maxWidth = 520,
}: DashboardHelpDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'min(88vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '14px',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '0.5px solid var(--border)',
            background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'var(--accent-muted)',
                border: '0.5px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              <BookOpen size={20} aria-hidden />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                id={titleId}
                style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}
              >
                {title}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {subtitle}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close guide">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>

        <div
          style={{
            padding: '14px 20px 18px',
            borderTop: '0.5px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
