'use client'

import StatsTab from './StatsTab'

export default function StatsPage() {
  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Stats</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
          Season leaders and game box scores. <strong>Games</strong> is for scheduling; <strong>Stats</strong> is
          for what happened on the court.
        </p>
      </div>
      <StatsTab />
    </div>
  )
}
