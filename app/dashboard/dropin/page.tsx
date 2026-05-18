'use client'

import { useState, useEffect } from 'react'
import { DashboardHowItWorksButton } from '@/components/dashboard/DashboardHowItWorksButton'
import DropinList from './DropinList'
import DropinDetail from './DropinDetail'
import DropinStandings from './DropinStandings'
import DropinHistory from './DropinHistory'
import DropinHelpDialog from './DropinHelpDialog'
import { DashboardPlanLockedHint } from '@/components/dashboard/DashboardPlanLockedHint'
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

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Drop-in Sessions
          </h1>
          <p className="page-subtitle">Run pickup sessions, check people in, and track fees</p>
        </div>
        <DashboardHowItWorksButton onClick={() => setShowHelp(true)} />
      </div>

      <DropinHelpDialog open={showHelp} onClose={() => setShowHelp(false)} />

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
      {activeTab === 'standings' ? (
        <div>
          {standingsLocked ? (
            <DashboardPlanLockedHint feature="track drop-in reputation tiers (gold / silver / warning) across sessions" />
          ) : null}
          <div style={{ opacity: standingsLocked ? 0.55 : 1, pointerEvents: standingsLocked ? 'none' : 'auto' }}>
            <DropinStandings />
          </div>
        </div>
      ) : null}
      {activeTab === 'history' && <DropinHistory />}
    </div>
  )
}