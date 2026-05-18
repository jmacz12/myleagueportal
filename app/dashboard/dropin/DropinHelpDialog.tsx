'use client'

import { DashboardHelpDialog } from '@/components/dashboard/DashboardHelpDialog'
import { DashboardHelpSection } from '@/components/dashboard/DashboardHelpSection'

type DropinHelpDialogProps = {
  open: boolean
  onClose: () => void
}

export default function DropinHelpDialog({ open, onClose }: DropinHelpDialogProps) {
  return (
    <DashboardHelpDialog
      open={open}
      onClose={onClose}
      title="Drop-in guide"
      subtitle="Run pickup sessions, check players in, and track payments."
      titleId="dropin-help-title"
    >
      <DashboardHelpSection title="What is a drop-in?">
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Open play without a full league schedule. Players sign up online; you check them in and mark who paid.
        </p>
      </DashboardHelpSection>

      <DashboardHelpSection title="Creating sessions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { title: 'One-time', desc: 'A single date and time.' },
            { title: 'Repeating', desc: 'Weekly, every two weeks, or monthly — up to a year ahead.' },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </DashboardHelpSection>

      <DashboardHelpSection title="When sign-ups open">
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Open now</strong> — sign-up is on immediately
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Keep closed</strong> — you turn sign-up on manually
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Schedule opening</strong> — opens X days before the session
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Custom date & time</strong> — opens when you choose
          </li>
        </ul>
      </DashboardHelpSection>

      <DashboardHelpSection title="On game day">
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Open a session to check people in and record payments. After midnight it moves to History.
        </p>
      </DashboardHelpSection>

      <DashboardHelpSection title="Guests">
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            marginBottom: '10px',
          }}
        >
          A player can bring guests; each guest signs the waiver. Guests stay with their host in team builder.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            { plan: 'Basic', guests: '1 guest' },
            { plan: 'Pro', guests: 'Up to 5' },
            { plan: 'Enterprise', guests: 'Unlimited' },
          ].map((p) => (
            <div
              key={p.plan}
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 8px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>{p.plan}</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {p.guests}
              </div>
            </div>
          ))}
        </div>
      </DashboardHelpSection>

      <DashboardHelpSection title="Points & reputation">
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            marginBottom: '10px',
          }}
        >
          Points update after each session. Only you see standings — players do not see each other&apos;s scores.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          {[
            { label: 'Showed up', pts: '+10', tone: 'good' as const },
            { label: 'Paid on time', pts: '+5', tone: 'good' as const },
            { label: 'No-show', pts: '−15', tone: 'bad' as const },
            { label: 'Late payment', pts: '−5', tone: 'bad' as const },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: item.tone === 'good' ? '#f0fdf4' : '#fef2f2',
                border: `0.5px solid ${item.tone === 'good' ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: item.tone === 'good' ? '#16a34a' : '#dc2626',
                }}
              >
                {item.pts}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { tier: 'Gold', pts: '200+', desc: 'Earlier on waitlists' },
            { tier: 'Silver', pts: '100–199', desc: 'Earlier on waitlists' },
            { tier: 'Bronze', pts: '0–99', desc: 'Normal order' },
            { tier: 'Warning', pts: 'Negative', desc: 'Back of waitlist' },
          ].map((t) => (
            <div
              key={t.tier}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 64px 1fr',
                gap: '8px',
                alignItems: 'center',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t.tier}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{t.pts}</span>
              <span style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </DashboardHelpSection>

      <DashboardHelpSection title="Auto matchup maker" badge="Pro">
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '8px' }}>
          Builds teams from who checked in. Guests stay with their host.
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Random</strong> — split evenly
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>By position</strong> — spread positions
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>By tier</strong> — balance top point-earners
          </li>
        </ul>
      </DashboardHelpSection>

      <DashboardHelpSection title="By plan">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            {
              plan: 'Basic',
              features: ['1 active session', '1 guest per player', 'Check-in & payments', '30-day history'],
            },
            {
              plan: 'Pro',
              features: [
                '10 active sessions',
                'Up to 5 guests',
                'Auto matchup maker',
                'Multiple courts',
                'Recurring sessions',
                '1-year history',
              ],
            },
            {
              plan: 'Enterprise',
              features: ['Unlimited sessions & guests', 'Tier-based balance', 'Unlimited history'],
            },
          ].map((p) => (
            <div
              key={p.plan}
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {p.plan}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '16px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DashboardHelpSection>
    </DashboardHelpDialog>
  )
}
