'use client'

import { useState, useEffect } from 'react'
import DropinList from './DropinList'
import DropinDetail from './DropinDetail'
import DropinStandings from './DropinStandings'
import DropinHistory from './DropinHistory'
import { DashboardPlanLockedCard } from '@/components/dashboard/DashboardPlanLockedCard'
import { isBasic, normalizeOrgPlan, type OrgPlanSlug } from '@/lib/org-plan-tier'
export default function DropinPage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'standings' | 'history'>('sessions')
  const [orgPlan, setOrgPlan] = useState<OrgPlanSlug>('basic')
  const [planLoaded, setPlanLoaded] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [defaultTab, setDefaultTab] = useState<'checkin' | 'payments' | 'teams'>('checkin')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    void fetch('/api/teams')
      .then((r) => r.json())
      .then((d) => {
        setOrgPlan(normalizeOrgPlan(d.org_plan))
        setPlanLoaded(true)
      })
      .catch(() => setPlanLoaded(true))
  }, [])

  const standingsLocked = planLoaded && isBasic(orgPlan)

  if (selectedSession) {
    return (
      <DropinDetail
        sessionId={selectedSession}
        defaultTab={defaultTab}
        onBack={() => { setSelectedSession(null); setDefaultTab('checkin') }}
      />
    )
  }

  return (
    <div style={{ maxWidth: '860px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Drop-in Sessions</h1>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              aria-label="Open drop-in help"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-muted)',
                border: '0.5px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '800',
                color: 'var(--accent)',
                cursor: 'pointer',
                flexShrink: 0,
                touchAction: 'manipulation',
              }}
            >?</button>
          </div>
          <p className="page-subtitle">Run pickup sessions, check people in, and track fees</p>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false) }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '16px',
          }}
        >
          <div style={{
            background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
            borderRadius: '14px', padding: '24px',
            maxWidth: '480px', width: '100%',
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                How drop-ins work
              </div>
              <button type="button" onClick={() => setShowHelp(false)}
                className="modal-close" aria-label="Close help">×</button>
            </div>

            {/* Section 1 — What is a drop-in */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                What is a drop-in?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                Open play: people sign up online, you check them in and note who paid. No league schedule required.
              </div>
            </div>

            {/* Section 2 — Creating sessions */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Creating Sessions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { title: 'One-time', desc: 'One date and time' },
                  { title: 'Repeating', desc: 'Adds weekly, every two weeks, or monthly dates (up to a year ahead)' },
                ].map((item) => (
                  <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3 — Signup timing */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Signup Timing
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                  { label: 'Open now', desc: 'Sign-up is on right away' },
                  { label: 'Keep closed', desc: 'You turn sign-up on when you want' },
                  { label: 'Schedule opening', desc: 'Opens a set number of days before the session' },
                  { label: 'Custom date & time', desc: 'Opens at a date and time you pick' },
                ].map((opt) => (
                  <div key={opt.label} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{opt.label}</strong> — {opt.desc}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4 — On the day */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                On the Day
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                Open a session to check people in and mark payments. After midnight it moves to History.
              </div>
            </div>

            {/* Section 5 — Guests */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Guests
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '8px' }}>
                A player can add guests; each guest signs the waiver. Guests stay with their host when you build teams.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { plan: 'Basic', guests: '1 guest', color: 'var(--text-muted)' },
                  { plan: 'Pro', guests: 'Up to 5', color: 'var(--accent)' },
                  { plan: 'Enterprise', guests: 'Unlimited', color: '#7c3aed' },
                ].map((p) => (
                  <div key={p.plan} style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: p.color }}>{p.plan}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>{p.guests}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 6 — Points */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Points & Reputation
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '8px' }}>
                Points update after each session. Only you see the standings list; players do not see each other&apos;s scores.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                {[
                  { label: 'Showed up', pts: '+10 pts', color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Paid on time', pts: '+5 pts', color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'No-show', pts: '−15 pts', color: '#dc2626', bg: '#fef2f2' },
                  { label: 'Late payment', pts: '−5 pts', color: '#dc2626', bg: '#fef2f2' },
                ].map((item) => (
                  <div key={item.label} style={{ background: item.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: item.color }}>{item.pts}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                  { tier: 'Gold', pts: '200+ pts', desc: 'Earlier on waitlists', color: '#92400e', bg: '#fffbeb' },
                  { tier: 'Silver', pts: '100–199 pts', desc: 'Earlier on waitlists', color: '#334155', bg: '#f1f5f9' },
                  { tier: 'Bronze', pts: '0–99 pts', desc: 'Normal order', color: '#9a3412', bg: '#fff7ed' },
                  { tier: 'Warning', pts: 'Negative', desc: 'Back of waitlist', color: '#dc2626', bg: '#fef2f2' },
                ].map((t) => (
                  <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: t.bg, color: t.color, border: `0.5px solid ${t.color}22`, borderRadius: '4px', fontSize: '10px', fontWeight: '800', padding: '2px 8px', width: '56px', textAlign: 'center', flexShrink: 0 }}>{t.tier}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', width: '70px', flexShrink: 0 }}>{t.pts}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 7 — Auto matchup */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Auto Matchup Maker
                <span style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '0.5px solid var(--accent)', borderRadius: '99px', fontSize: '9px', fontWeight: '700', padding: '1px 7px', marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>Pro</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '8px' }}>
                Builds teams from who checked in. Guests stay with their host.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                  { label: 'Random', desc: 'Split people evenly' },
                  { label: 'By position', desc: 'Spread positions across teams' },
                  { label: 'By tier', desc: 'Spread top point-earners so sides stay even' },
                ].map((m) => (
                  <div key={m.label} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{m.label}</strong> — {m.desc}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 8 — Plan limits */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Plan Features
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  {
                    plan: 'Basic', color: 'var(--text-muted)',
                    features: ['2 active sessions', '1 guest per player', 'Check-in & payment tracking', '30 day history'],
                  },
                  {
                    plan: 'Pro', color: 'var(--accent)',
                    features: ['10 active sessions', 'Up to 5 guests per player', 'Auto matchup maker', 'Multiple courts', 'Recurring sessions', 'Team builder', '1 year history'],
                  },
                  {
                    plan: 'Enterprise', color: '#7c3aed',
                    features: ['Unlimited sessions', 'Unlimited guests', 'Tier-based auto-balance', 'Advanced analytics', 'Unlimited history'],
                  },
                ].map((p) => (
                  <div key={p.plan} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: p.color, marginBottom: '6px' }}>{p.plan}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {p.features.map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>•</span>
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setShowHelp(false)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div
        className="dropin-main-tabs"
        style={{
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border)',
          borderRadius: '10px',
          padding: '6px',
          marginBottom: '24px',
        }}
      >
        {[
          { id: 'sessions', label: 'Sessions' },
          { id: 'standings', label: 'Standings' },
          { id: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as 'sessions' | 'standings' | 'history')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: activeTab === tab.id ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTab === tab.id ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' && (
        <DropinList
          onSelectSession={(id, tab) => {
            setDefaultTab(tab || 'checkin')
            setSelectedSession(id)
          }}
        />
      )}
      {activeTab === 'standings' && standingsLocked ? (
        <DashboardPlanLockedCard
          title="Drop-in standings"
          body={
            <>
              On <strong>Basic</strong>, you can still run drop-in sessions and check people in. Upgrade to{' '}
              <strong>Pro</strong> or <strong>Enterprise</strong> to track player reputation tiers (gold / silver /
              warning) across sessions.
            </>
          }
        />
      ) : null}
      {activeTab === 'standings' && !standingsLocked ? <DropinStandings /> : null}
      {activeTab === 'history' && <DropinHistory />}
    </div>
  )
}