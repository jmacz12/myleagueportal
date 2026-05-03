'use client'

import { useState } from 'react'

interface Registration {
  id: string
  full_name: string
  positions: string[]
  is_guest: boolean
  host_registration_id: string | null
  team_name: string | null
  court_number: number | null
  checked_in: boolean
}

interface Props {
  sessionId: string
  registrations: Registration[]
  onRefresh: () => void
}

export default function DropinTeamBuilder({ sessionId, registrations, onRefresh }: Props) {
  const [courts, setCourts] = useState(2)
  const [teams, setTeams] = useState<Record<string, Registration[]>>({})
  const [built, setBuilt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [buildMethod, setBuildMethod] = useState<'random' | 'position'>('random')

  const activePlayers = registrations.filter(r => r.checked_in)

  function autoBuildTeams() {
    const shuffled = [...activePlayers]

    if (buildMethod === 'random') {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
    }

    // Group guests with hosts first
    const hosts = shuffled.filter(p => !p.is_guest)
    const result: Record<string, Registration[]> = {}

    for (let i = 1; i <= courts * 2; i++) {
      result[`Court ${Math.ceil(i / 2)} — Team ${i % 2 === 1 ? 'A' : 'B'}`] = []
    }

    const teamKeys = Object.keys(result)
    hosts.forEach((player, idx) => {
      const teamKey = teamKeys[idx % teamKeys.length]
      result[teamKey].push(player)
      // Add their guests to the same team
      const playerGuests = registrations.filter(r => r.is_guest && r.host_registration_id === player.id && r.checked_in)
      playerGuests.forEach(g => result[teamKey].push(g))
    })

    setTeams(result)
    setBuilt(true)
  }

  async function saveTeams() {
    setSaving(true)
    const assignments = Object.entries(teams).flatMap(([teamName, players]) =>
      players.map(p => ({
        registration_id: p.id,
        team_name: teamName,
      }))
    )

    await fetch(`/api/dropin/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_assignments: assignments }),
    })

    setSaving(false)
    onRefresh()
  }

  function movePlayer(playerId: string, fromTeam: string, toTeam: string) {
    const player = teams[fromTeam]?.find(p => p.id === playerId)
    if (!player) return
    setTeams(prev => ({
      ...prev,
      [fromTeam]: prev[fromTeam].filter(p => p.id !== playerId),
      [toTeam]: [...(prev[toTeam] || []), player],
    }))
  }

  if (activePlayers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛡️</div>
        <div className="empty-state-title">No checked-in players yet</div>
        <div className="empty-state-desc">Check in players first before building teams.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Pro badge notice */}
      <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--accent)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '0.5px solid var(--accent)', borderRadius: '99px', fontSize: '10px', fontWeight: '700', padding: '2px 8px' }}>Pro</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Team builder — guests are automatically kept with their host player</span>
      </div>

      {/* Build controls */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label className="label">Number of courts</label>
            <select value={courts} onChange={(e) => setCourts(parseInt(e.target.value))} className="input">
              <option value={1}>1 court (2 teams)</option>
              <option value={2}>2 courts (4 teams)</option>
              <option value={3}>3 courts (6 teams)</option>
              <option value={4}>4 courts (8 teams)</option>
            </select>
          </div>
          <div>
            <label className="label">Build method</label>
            <select value={buildMethod} onChange={(e) => setBuildMethod(e.target.value as any)} className="input">
              <option value="random">Random</option>
              <option value="position">By position</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={autoBuildTeams} className="btn-primary">
            ⚡ Auto-build Teams
          </button>
          {built && (
            <button onClick={autoBuildTeams} className="btn-s" style={{ fontSize: '12px' }}>
              Rebuild
            </button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {activePlayers.length} players checked in
          </span>
        </div>
      </div>

      {/* Team display */}
      {built && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {Object.entries(teams).map(([teamName, players]) => (
              <div key={teamName} className="card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '8px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {teamName}
                  </span>
                  <span style={{
                    background: 'var(--bg-elevated)', border: '0.5px solid var(--border)',
                    borderRadius: '99px', fontSize: '11px', color: 'var(--text-muted)',
                    fontWeight: '600', padding: '1px 8px', minWidth: '24px', textAlign: 'center',
                  }}>
                    {players.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {players.map((player) => (
                    <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: player.is_guest ? 'var(--bg-elevated)' : 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: 'var(--text-primary)', flexShrink: 0, border: player.is_guest ? '1px dashed var(--border)' : 'none' }}>
                        {player.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: player.is_guest ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {player.full_name}
                          {player.is_guest && <span style={{ fontSize: '9px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: '4px', padding: '1px 4px', border: '0.5px solid var(--border)' }}>guest</span>}
                        </div>
                        {player.positions && player.positions.length > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{player.positions.join(', ')}</div>
                        )}
                      </div>
                      {/* Move player dropdown */}
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) movePlayer(player.id, teamName, e.target.value) }}
                        style={{ fontSize: '10px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '4px', padding: '2px 4px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '70px' }}
                      >
                        <option value="">Move</option>
                        {Object.keys(teams).filter(t => t !== teamName).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {players.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>Empty team</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={saveTeams} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Lock Teams →'}
            </button>
            <button onClick={() => setBuilt(false)} className="btn-s">Reset</button>
          </div>
        </>
      )}
    </div>
  )
}