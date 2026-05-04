'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTheme } from '@/lib/theme'

const themes = [
  { id: 'original', name: 'Original', desc: 'Khaki & olive green', dot: '#5a7a2a', dot2: '#f2ead6', plan: 'basic' },
  { id: 'light', name: 'Light', desc: 'Clean white & slate', dot: '#2563eb', dot2: '#ffffff', plan: 'pro' },
  { id: 'dark', name: 'Dark', desc: 'Dark gray & blue', dot: '#2563eb', dot2: '#1a1a1a', plan: 'pro' },
  { id: 'auto', name: 'Auto', desc: 'Follows device setting', dot: '#6366f1', dot2: '#f8fafc', plan: 'enterprise' },
  { id: 'sunset', name: 'Sunset', desc: 'Deep brown & orange', dot: '#e8640a', dot2: '#1a0e06', plan: 'enterprise' },
]

const planOrder = { basic: 0, pro: 1, enterprise: 2 }

const planLabel: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

interface Props { plan: string }

export default function ThemeSelector({ plan }: Props) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const canUse = (themePlan: string) =>
    planOrder[plan as keyof typeof planOrder] >= planOrder[themePlan as keyof typeof planOrder]

  const current = themes.find(t => t.id === theme) || themes[0]

  return (
    <div style={{ position: 'relative' }}>

      {/* Current theme display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: 'var(--bg-elevated)',
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: current.dot2, border: '1.5px solid var(--border)',
            }} />
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: current.dot, border: '2px solid var(--bg-surface)',
              position: 'absolute', bottom: '-2px', right: '-4px',
            }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {current.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{current.desc}</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          {open ? 'Close' : 'Change'}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {themes.map((t) => {
            const unlocked = canUse(t.plan)
            const active = theme === t.id
            return (
              <div
                key={t.id}
                onClick={() => {
                  if (!unlocked) return
                  setTheme(t.id as any)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  opacity: unlocked ? 1 : 0.5,
                  background: active ? 'var(--accent-muted)' : 'transparent',
                  borderBottom: '0.5px solid var(--border-light)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (unlocked && !active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--accent-muted)' : 'transparent' }}
              >
                <div style={{ position: 'relative', width: '22px', height: '22px', flexShrink: 0 }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.dot2, border: '1.5px solid var(--border)' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.dot, border: '2px solid var(--bg-surface)', position: 'absolute', bottom: '-2px', right: '-3px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.desc}</div>
                </div>
                {!unlocked && (
                  <span style={{
                    fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                    borderRadius: '99px', background: 'var(--bg-elevated)',
                    color: 'var(--text-muted)', border: '0.5px solid var(--border)',
                  }}>
                    {planLabel[t.plan]}
                  </span>
                )}
                {active && unlocked && (
                  <Check size={14} strokeWidth={2.5} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}