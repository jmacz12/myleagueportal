'use client'

import { useState } from 'react'
import GamesTab from './GamesTab'
import DropinTab from './DropinTab'

export default function GamesPage() {
  const [activeTab, setActiveTab] = useState<'games' | 'dropin'>('games')

  return (
    <div style={{ maxWidth: '860px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Games & Sessions</h1>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--bg-elevated)',
        border: '0.5px solid var(--border)',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '24px',
        width: 'fit-content',
      }}>
        {[
          { id: 'games', label: 'League games' },
          { id: 'dropin', label: 'Drop-in sessions' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'games' | 'dropin')}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
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

      {activeTab === 'games' && <GamesTab />}
      {activeTab === 'dropin' && <DropinTab />}
    </div>
  )
}