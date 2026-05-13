'use client'

import { useState } from 'react'
import { SignUp } from '@clerk/nextjs'
import {
  DEFAULT_SPORT_TEMPLATE_ID,
  MLP_PREF_SPORT_STORAGE_KEY,
  SPORT_TEMPLATES,
  type SportTemplateId,
} from '@/lib/sport-templates'

type Phase = 'sport' | 'clerk'

/**
 * Account sign-up: organizer picks **primary sport** first so league + registration positions
 * line up before any players exist. Choice is passed to `/onboarding` via `sessionStorage`.
 */
export function SignUpWithPrefSport() {
  const [phase, setPhase] = useState<Phase>('sport')
  const [sportId, setSportId] = useState<SportTemplateId>(DEFAULT_SPORT_TEMPLATE_ID)

  if (phase === 'sport') {
    return (
      <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Step 1 of 2.</strong> Choose the primary sport for the league you&apos;re about to
          create. It controls player position tags on season sign-up. You won&apos;t change this from the dashboard later—if it&apos;s wrong, delete
          your MyLeaguePortal account and sign up again.
        </p>
        <label className="label" style={{ marginBottom: '8px', display: 'block' }}>
          Primary sport *
        </label>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: 'min(52vh, 360px)',
            overflowY: 'auto',
            marginBottom: '16px',
            paddingRight: '4px',
          }}
        >
          {SPORT_TEMPLATES.map((t) => {
            const selected = sportId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSportId(t.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: selected ? '2px solid var(--accent)' : '0.5px solid var(--border)',
                  background: selected ? 'var(--accent-muted)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{t.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>{t.blurb}</div>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '14px' }}
          onClick={() => {
            try {
              sessionStorage.setItem(MLP_PREF_SPORT_STORAGE_KEY, sportId)
            } catch {
              /* private mode */
            }
            setPhase('clerk')
          }}
        >
          Continue to create account →
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.45 }}>
        <strong style={{ color: 'var(--text-primary)' }}>Step 2 of 2.</strong> Create your account, then name your league. Sport stays{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{SPORT_TEMPLATES.find((s) => s.id === sportId)?.name}</strong> unless you go back and
        restart sign-up.
      </p>
      <SignUp fallbackRedirectUrl="/onboarding" signInFallbackRedirectUrl="/sign-in" />
    </div>
  )
}
