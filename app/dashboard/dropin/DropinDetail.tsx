'use client'

import { useState, useEffect, useCallback } from 'react'
import DropinCheckin from './DropinCheckin'
import DropinPayments from './DropinPayments'
import DropinTeamBuilder from './DropinTeamBuilder'

interface Session {
  id: string
  name: string
  scheduled_at: string
  location: string | null
  max_players: number
  max_waitlist?: number
  fee_amount: number
  payment_method: string
  etransfer_info: string | null
  status: string
}

interface Registration {
  id: string
  full_name: string
  email: string | null
  checked_in: boolean
  payment_status: string
  amount_paid: number
  positions: string[]
  is_guest: boolean
  host_registration_id: string | null
  guest_count: number
  team_name: string | null
  court_number: number | null
  is_waitlist?: boolean
}

interface Props {
  sessionId: string
  defaultTab?: 'checkin' | 'payments' | 'teams'
  onBack: () => void
}

export default function DropinDetail({ sessionId, defaultTab = 'checkin', onBack }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'checkin' | 'payments' | 'teams'>(defaultTab)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/dropin/${sessionId}`)
    const data = await res.json()
    setSession(data.session)
    setRegistrations(data.registrations || [])
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const checkedIn = registrations.filter(r => r.checked_in && !r.is_guest && !r.is_waitlist).length
  const noShows = registrations.filter(r => !r.checked_in && !r.is_guest).length
  const totalPlayers = registrations.filter(r => !r.is_guest && !r.is_waitlist).length
  const totalWaitlist = registrations.filter(r => !r.is_guest && !!r.is_waitlist).length
  const totalGuests = registrations.filter(r => r.is_guest).length

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading session...</div>
  )

  return (
    <div style={{ maxWidth: '860px' }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '12px',
          padding: '10px 4px 10px 0',
          minHeight: '44px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          touchAction: 'manipulation',
        }}
      >
        ← Back to Sessions
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {session?.name}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {session && new Date(session.scheduled_at).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
          {session?.location && ` · ${session.location}`}
          {session?.fee_amount && session.fee_amount > 0 && ` · $${session.fee_amount}/person`}
        </p>
      </div>

      {/* Stats */}
      <div className="dropin-detail-stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-number" style={{ color: 'var(--accent)' }}>{totalPlayers}</div>
          <div className="stat-label">Roster</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalWaitlist}</div>
          <div className="stat-label">Waitlist</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalGuests}</div>
          <div className="stat-label">Guests</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{checkedIn}</div>
          <div className="stat-label">Checked In</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: noShows > 0 ? '#dc2626' : 'var(--text-primary)' }}>{noShows}</div>
          <div className="stat-label">No-shows</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dropin-main-tabs" style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '6px', marginBottom: '16px' }}>
        {[
          { id: 'checkin', label: 'Check-in' },
          { id: 'payments', label: 'Payments' },
          { id: 'teams', label: 'Team Builder', dataTab: 'teams' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as 'checkin' | 'payments' | 'teams')}
            style={{
              padding: '10px 14px',
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

      {activeTab === 'checkin' && (
        <DropinCheckin sessionId={sessionId} registrations={registrations} onRefresh={fetchData} />
      )}
      {activeTab === 'payments' && (
        <DropinPayments sessionId={sessionId} session={session} registrations={registrations} onRefresh={fetchData} />
      )}
      {activeTab === 'teams' && (
        <DropinTeamBuilder sessionId={sessionId} registrations={registrations} onRefresh={fetchData} />
      )}
    </div>
  )
}