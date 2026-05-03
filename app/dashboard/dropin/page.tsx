'use client'

import { useState } from 'react'
import DropinList from './DropinList'
import DropinDetail from './DropinDetail'
import DropinStandings from './DropinStandings'
import DropinHistory from './DropinHistory'

export default function DropinPage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'standings' | 'history'>('sessions')
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [defaultTab, setDefaultTab] = useState<'checkin' | 'payments' | 'teams'>('checkin')
  const [showHelp, setShowHelp] = useState(false)

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
              onClick={() => setShowHelp(true)}
              style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'var(--accent-muted)', border: '0.5px solid var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: '800', color: 'var(--accent)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >?</button>
          </div>
          <p className="page-subtitle">Manage casual sessions, track attendance and payments</p>
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
                Drop-in Sessions — Full Guide
              </div>
              <button onClick={() => setShowHelp(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '0', fontWeight: '700' }}>×</button>
            </div>

            {/* Section 1 — What is a drop-in */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                What is a Drop-in Session?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                Drop-in sessions are casual, open play sessions — no fixed teams or standings needed. Players sign up, show up, and play. You handle check-in and payment tracking all in one place.
              </div>
            </div>

            {/* Section 2 — Creating sessions */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Creating Sessions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { icon: '📅', title: 'One-time', desc: 'A single session on a specific date' },
                  { icon: '🔄', title: 'Recurring', desc: 'Auto-creates weekly, biweekly or monthly sessions up to 52 weeks ahead' },
                ].map((item) => (
                  <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
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
                  { icon: '🟢', label: 'Open now', desc: 'Players can sign up immediately' },
                  { icon: '🔒', label: 'Keep closed', desc: 'You open it manually when ready' },
                  { icon: '⏰', label: 'Schedule opening', desc: 'Auto-opens X days before session' },
                  { icon: '📆', label: 'Custom date & time', desc: 'Opens at an exact date and time' },
                ].map((opt) => (
                  <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ flexShrink: 0 }}>{opt.icon}</span>
                    <span><strong style={{ color: 'var(--text-primary)' }}>{opt.label}</strong> — {opt.desc}</span>
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
                Open the session and tap <strong>Manage</strong> to check players in, mark no-shows, and track payments. Sessions auto-close at midnight and move to History.
              </div>
            </div>

            {/* Section 5 — Guests */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Guest System
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '8px' }}>
                Players can bring guests. Each guest must accept the liability waiver. Guests are automatically grouped with their host in the Team Builder.
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
                Points are awarded automatically after each session. Only you can see standings — players never see each other's points.
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
                  { tier: 'Gold', pts: '200+ pts', desc: 'Priority waitlist spot', color: '#92400e', bg: '#fffbeb' },
                  { tier: 'Silver', pts: '100–199 pts', desc: 'Priority waitlist spot', color: '#334155', bg: '#f1f5f9' },
                  { tier: 'Bronze', pts: '0–99 pts', desc: 'Standard access', color: '#9a3412', bg: '#fff7ed' },
                  { tier: 'Warning', pts: 'Negative', desc: 'Last on waitlist', color: '#dc2626', bg: '#fef2f2' },
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
                Automatically build balanced teams based on how many courts and players you have. Guests stay with their host.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                  { icon: '🎲', label: 'Random', desc: 'Shuffle players evenly across teams' },
                  { icon: '🏀', label: 'By position', desc: 'Balance PGs, bigs, etc. across courts' },
                  { icon: '🏅', label: 'By tier', desc: 'Spread Gold players so games are competitive' },
                ].map((m) => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ flexShrink: 0 }}>{m.icon}</span>
                    <span><strong style={{ color: 'var(--text-primary)' }}>{m.label}</strong> — {m.desc}</span>
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
                          <span style={{ color: 'var(--accent)', fontWeight: '700', flexShrink: 0 }}>✓</span>
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
      <div style={{
        display: 'flex', gap: '4px',
        background: 'var(--bg-elevated)',
        border: '0.5px solid var(--border)',
        borderRadius: '10px', padding: '4px',
        marginBottom: '24px', width: 'fit-content',
      }}>
        {[
          { id: 'sessions', label: '🎲 Sessions' },
          { id: 'standings', label: '🏅 Standings' },
          { id: 'history', label: '📋 History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px', borderRadius: '7px',
              fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
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
      {activeTab === 'standings' && <DropinStandings />}
      {activeTab === 'history' && <DropinHistory />}
    </div>
  )
}