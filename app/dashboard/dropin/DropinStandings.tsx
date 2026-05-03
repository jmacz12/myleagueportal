'use client'

import { useState, useEffect } from 'react'

interface PlayerRep {
  id: string
  player_id: string
  points: number
  sessions_attended: number
  sessions_registered: number
  total_paid: number
  total_owed: number
  tier: string
  is_inactive: boolean
  consecutive_noshows: number
  players: {
    full_name: string
    email: string | null
  }
}

interface RepSettings {
  points_attended: number
  points_paid_on_time: number
  points_noshow: number
  points_late_payment: number
  points_streak_3: number
  tier_gold: number
  tier_silver: number
  inactive_threshold: number
}

export default function DropinStandings() {
  const [standings, setStandings] = useState<PlayerRep[]>([])
  const [settings, setSettings] = useState<RepSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'standings' | 'inactive' | 'settings'>('standings')
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustForm, setAdjustForm] = useState({ amount: '10', action: 'add', reason: '' })
  const [filterTier, setFilterTier] = useState('all')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [repRes, settingsRes] = await Promise.all([
      fetch('/api/dropin/standings'),
      fetch('/api/dropin/settings'),
    ])
    const [repData, settingsData] = await Promise.all([repRes.json(), settingsRes.json()])
    setStandings(repData.standings || [])
    setSettings(settingsData.settings)
    setLoading(false)
  }

  async function adjustPoints(playerId: string, playerRepId: string) {
    if (!adjustForm.reason) { alert('Please select a reason'); return }
    setSaving(true)
    const amount = parseInt(adjustForm.amount)
    const change = adjustForm.action === 'add' ? amount : -amount

    await fetch('/api/dropin/standings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, points_change: change, reason: adjustForm.reason }),
    })

    setAdjustingId(null)
    setAdjustForm({ amount: '10', action: 'add', reason: '' })
    setSaving(false)
    fetchData()
  }

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/dropin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    fetchData()
  }

  async function handleInactive(playerId: string, action: 'keep' | 'remove') {
    await fetch('/api/dropin/standings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, inactive_action: action }),
    })
    fetchData()
  }

  const filtered = standings.filter(s => filterTier === 'all' || s.tier === filterTier)
  const inactive = standings.filter(s => s.is_inactive)

  const tierStyle = (tier: string) => {
    if (tier === 'gold') return { background: '#fffbeb', color: '#92400e', border: '0.5px solid #fde68a' }
    if (tier === 'silver') return { background: '#f1f5f9', color: '#334155', border: '0.5px solid #cbd5e1' }
    if (tier === 'warning') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' }
    return { background: '#fff7ed', color: '#9a3412', border: '0.5px solid #fed7aa' }
  }

  const tierLabel = (tier: string) => {
    if (tier === 'gold') return 'Gold'
    if (tier === 'silver') return 'Silver'
    if (tier === 'warning') return 'Warning'
    return 'Bronze'
  }

  const maxPts = standings.length > 0 ? Math.max(...standings.map(s => s.points), 1) : 1

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading standings...</div>

  return (
    <div>
      {/* Private notice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 10px' }}>
          🔒 Private — only you can see player standings
        </span>
        {inactive.length > 0 && (
          <span style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '700', padding: '4px 10px', cursor: 'pointer' }}
            onClick={() => setActiveTab('inactive')}>
            ⚠️ {inactive.length} inactive
          </span>
        )}
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '16px', width: 'fit-content' }}>
        {[
          { id: 'standings', label: 'Standings' },
          { id: 'inactive', label: `Inactive${inactive.length > 0 ? ` (${inactive.length})` : ''}` },
          { id: 'settings', label: 'Point Rules' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            style={{ padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab.id ? 'var(--btn-primary-bg)' : 'transparent', color: activeTab === tab.id ? 'var(--btn-primary-text)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* STANDINGS */}
      {activeTab === 'standings' && (
        <>
          {/* Stats summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-number" style={{ color: '#92400e' }}>{standings.filter(s => s.tier === 'gold').length}</div>
              <div className="stat-label">Gold</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-number" style={{ color: '#334155' }}>{standings.filter(s => s.tier === 'silver').length}</div>
              <div className="stat-label">Silver</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-number" style={{ color: '#dc2626' }}>{standings.filter(s => s.tier === 'warning').length}</div>
              <div className="stat-label">Warning</div>
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['all', 'gold', 'silver', 'bronze', 'warning'].map(t => (
              <button key={t} onClick={() => setFilterTier(t)}
                style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '10px', fontWeight: '700', border: filterTier === t ? '1.5px solid var(--btn-primary-bg)' : '0.5px solid var(--border)', background: filterTier === t ? 'var(--btn-primary-bg)' : 'transparent', color: filterTier === t ? 'var(--btn-primary-text)' : 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                {t === 'all' ? 'All' : tierLabel(t)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏅</div>
              <div className="empty-state-title">No standings yet</div>
              <div className="empty-state-desc">Standings build up as players attend and pay for sessions.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map((rep, index) => (
                <div key={rep.id} className="card" style={{ padding: '12px', borderColor: rep.tier === 'warning' ? '#fecaca' : 'var(--border)', background: rep.tier === 'warning' ? '#fff8f8' : 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', width: '16px', flexShrink: 0 }}>{index + 1}</div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: rep.tier === 'gold' ? '#fde68a' : rep.tier === 'silver' ? '#e2e8f0' : rep.tier === 'warning' ? '#fecaca' : '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: '#1a1a0a', flexShrink: 0 }}>
                      {rep.players?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{rep.players?.full_name}</span>
                        <span style={{ ...tierStyle(rep.tier), borderRadius: '6px', fontSize: '9px', fontWeight: '800', padding: '2px 8px' }}>{tierLabel(rep.tier)}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {rep.sessions_attended} sessions · {rep.sessions_registered - rep.sessions_attended} no-shows
                      </div>
                      <div style={{ background: 'var(--bg-elevated)', borderRadius: '99px', height: '4px', marginTop: '6px' }}>
                        <div style={{ background: rep.tier === 'warning' ? '#dc2626' : 'var(--accent)', borderRadius: '99px', height: '4px', width: `${Math.max(0, Math.min(100, (rep.points / maxPts) * 100))}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: rep.points < 0 ? '#dc2626' : 'var(--accent)', lineHeight: '1' }}>{rep.points}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>pts</div>
                    </div>
                  </div>

                  {/* Point adjustment */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--border-light)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', flexShrink: 0 }}>Adjust:</span>
                    <button
                      style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', background: adjustingId === rep.id && adjustForm.action === 'remove' ? '#fecaca' : '#fef2f2', color: '#dc2626', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onClick={() => { setAdjustingId(rep.id); setAdjustForm(f => ({ ...f, action: 'remove' })) }}>−</button>
                    <input type="number" value={adjustForm.amount} min="1" max="100"
                      onChange={(e) => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ width: '48px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '3px 6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit' }} />
                    <button
                      style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', background: '#e8f0d0', color: '#3a5a10', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onClick={() => { setAdjustingId(rep.id); setAdjustForm(f => ({ ...f, action: 'add' })) }}>+</button>
                    <select value={adjustForm.reason} onChange={(e) => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                      style={{ flex: 1, minWidth: '120px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                      <option value="">Select reason...</option>
                      <option value="Consistent attendance bonus">Consistent attendance bonus</option>
                      <option value="Paid early">Paid early</option>
                      <option value="Helped organize session">Helped organize session</option>
                      <option value="Late payment">Late payment</option>
                      <option value="Repeated no-shows">Repeated no-shows</option>
                      <option value="Unsportsmanlike conduct">Unsportsmanlike conduct</option>
                    </select>
                    <button onClick={() => adjustPoints(rep.player_id, rep.id)} disabled={saving || !adjustForm.reason}
                      className="btn-g" style={{ fontSize: '10px', padding: '4px 10px', flexShrink: 0 }}>
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* INACTIVE */}
      {activeTab === 'inactive' && (
        <div>
          {inactive.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✓</div>
              <div className="empty-state-title">No inactive players</div>
              <div className="empty-state-desc">Players who miss {settings?.inactive_threshold || 15}+ sessions will appear here.</div>
            </div>
          ) : (
            <>
              <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '2px' }}>
                  {inactive.length} player{inactive.length !== 1 ? 's' : ''} flagged for inactivity
                </div>
                <div style={{ fontSize: '11px', color: '#92400e' }}>
                  These players haven't shown up in {settings?.inactive_threshold || 15}+ sessions. Review and decide.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {inactive.map((rep) => (
                  <div key={rep.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }}>
                      {rep.players?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>{rep.players?.full_name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {rep.consecutive_noshows} consecutive no-shows · {rep.points} pts
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => handleInactive(rep.player_id, 'keep')} className="btn-s" style={{ fontSize: '10px', padding: '5px 8px' }}>Keep</button>
                      <button onClick={() => handleInactive(rep.player_id, 'remove')}
                        style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', color: '#dc2626', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => inactive.forEach(r => handleInactive(r.player_id, 'remove'))} className="btn-primary" style={{ fontSize: '12px' }}>
                  Remove All Inactive
                </button>
                <button onClick={() => inactive.forEach(r => handleInactive(r.player_id, 'keep'))} className="btn-s" style={{ fontSize: '12px' }}>
                  Keep All
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div>
          <div className="card" style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px' }}>Point Rules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { key: 'points_attended', label: 'Showed up', sign: '+' },
                { key: 'points_paid_on_time', label: 'Paid on time', sign: '+' },
                { key: 'points_streak_3', label: '3-session streak bonus', sign: '+' },
                { key: 'points_noshow', label: 'No-show', sign: '−' },
                { key: 'points_late_payment', label: 'Late payment', sign: '−' },
              ].map((rule) => (
                <div key={rule.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{rule.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '12px', color: rule.sign === '+' ? '#16a34a' : '#dc2626', fontWeight: '700' }}>{rule.sign}</span>
                    <input type="number" value={(settings as any)[rule.key]} min="0" max="100"
                      onChange={(e) => setSettings({ ...settings, [rule.key]: parseInt(e.target.value) || 0 })}
                      style={{ width: '52px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px' }}>Tier Thresholds</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { key: 'tier_gold', label: 'Gold', style: { background: '#fffbeb', color: '#92400e', border: '0.5px solid #fde68a', borderRadius: '6px', fontSize: '11px', fontWeight: '800', padding: '3px 10px' } },
                { key: 'tier_silver', label: 'Silver', style: { background: '#f1f5f9', color: '#334155', border: '0.5px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontWeight: '800', padding: '3px 10px' } },
              ].map((tier) => (
                <div key={tier.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={tier.style}>{tier.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>≥</span>
                    <input type="number" value={(settings as any)[tier.key]} min="1"
                      onChange={(e) => setSettings({ ...settings, [tier.key]: parseInt(e.target.value) || 0 })}
                      style={{ width: '60px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit' }} />
                    <span>pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px' }}>Inactivity Threshold</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="number" value={settings.inactive_threshold} min="5" max="50"
                onChange={(e) => setSettings({ ...settings, inactive_threshold: parseInt(e.target.value) || 15 })}
                style={{ width: '60px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>missed sessions before flagging as inactive</span>
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}