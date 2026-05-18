'use client'

import StatsTab from './StatsTab'
import { DashboardHelpLauncher } from '@/components/dashboard/DashboardHelpLauncher'

export default function StatsPage() {
  return (
    <div style={{ maxWidth: '860px' }}>
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Stats
          </h1>
          <p className="page-subtitle" style={{ maxWidth: '520px' }}>
            Season leaders and game box scores. <strong>Games</strong> is for scheduling; <strong>Stats</strong> is for
            what happened on the court.
          </p>
        </div>
        <DashboardHelpLauncher topic="stats" />
      </div>
      <StatsTab />
    </div>
  )
}
