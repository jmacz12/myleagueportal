'use client'

import { useState, useEffect } from 'react'
import DropinCheckin from './DropinCheckin'
import DropinPayments from './DropinPayments'
import DropinTeamBuilder from './DropinTeamBuilder'

interface Session {
  id: string
  name: string
  scheduled_at: string
  location: string | null
  max_players: number
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

  useEffect(() => { fetchData() }, [sessionId])

  async function fetchData() {
    const res = await fetch(`/api/dropin/${sessionId}`)
    const data = await res.json()
    setSession(data.session)
    setRegistrations(data.registrations || [])
    setLoading(false)
  }

  const checkedIn = registrations.filter(r => r.checked_in && !r.is_guest).length
  const noShows = registrations.filter(r => !r.checked_in && !r.is_guest).length
  const totalPlayers = registrations.filter(r => !r.is_guest).length
  const totalGuests = registrations.filter(r => r.is_guest).length

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading session...</div>
  )

  return (
    <div style={{ maxWidth: '860px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-number" style={{ color: 'var(--accent)' }}>{totalPlayers}</div>
          <div className="stat-label">Players</div>
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
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '16px', width: 'fit-content' }}>
        {[
          { id: 'checkin', label: 'Check-in' },
          { id: 'payments', label: 'Payments' },
          { id: 'teams', label: 'Team Builder', dataTab: 'teams' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            style={{ padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab.id ? 'var(--btn-primary-bg)' : 'transparent', color: activeTab === tab.id ? 'var(--btn-primary-text)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
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