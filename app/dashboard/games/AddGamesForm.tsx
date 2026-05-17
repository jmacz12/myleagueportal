'use client'

import { useState, useEffect } from 'react'
import ScheduleImportPanel from './ScheduleImportPanel'
import { isProOrEnterprise, normalizeOrgPlan, type OrgPlanSlug } from '@/lib/org-plan-tier'

interface Team { id: string; name: string; season_id: string }
interface Season { id: string; name: string }

interface GameRow {
  home_team_id: string
  away_team_id: string
  date: string
  time: string
  location: string
}

type AddMode = 'manual' | 'import'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function AddGamesForm({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<AddMode>('manual')
  const [orgPlan, setOrgPlan] = useState<OrgPlanSlug | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeason, setSelectedSeason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<GameRow[]>([
    { home_team_id: '', away_team_id: '', date: '', time: '', location: '' },
    { home_team_id: '', away_team_id: '', date: '', time: '', location: '' },
  ])

  const canImport = orgPlan !== null && isProOrEnterprise(orgPlan)

  useEffect(() => {
    void fetchData()
  }, [])

  async function fetchData() {
    const [teamsRes, seasonsRes, prefsRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/seasons'),
      fetch('/api/games/scoring-preferences'),
    ])
    const teamsData = await teamsRes.json()
    const seasonsData = await seasonsRes.json()
    const prefs = await prefsRes.json().catch(() => null)
    const seasonList = seasonsData.seasons || []
    setTeams(teamsData.teams || [])
    setSeasons(seasonList)
    if (prefs?.plan !== undefined) {
      const plan = normalizeOrgPlan(prefs.plan)
      setOrgPlan(plan)
      if (isProOrEnterprise(plan)) setMode('import')
    }
    const active = seasonList.find((s: { is_active?: boolean }) => s.is_active)
    setSelectedSeason(active?.id ?? seasonList[0]?.id ?? '')
  }

  function updateRow(index: number, field: keyof GameRow, value: string) {
    const updated = [...rows]
    updated[index] = { ...updated[index], [field]: value }
    setRows(updated)
  }

  function addRow() {
    setRows([...rows, { home_team_id: '', away_team_id: '', date: '', time: '', location: '' }])
  }

  function removeRow(index: number) {
    if (rows.length === 1) return
    setRows(rows.filter((_, i) => i !== index))
  }

  const validRows = rows.filter((r) => r.home_team_id && r.away_team_id && r.date && r.time)
  const seasonTeams = teams.filter((t) => t.season_id === selectedSeason)

  async function handleSubmit() {
    if (validRows.length === 0) {
      setError('Please fill in at least one game with teams, date and time.')
      return
    }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: validRows, season_id: selectedSeason }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      setSubmitting(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
              Add Games
            </div>
            <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
              ×
            </button>
          </div>

          {canImport ? (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={mode === 'import' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setMode('import')}
              >
                Import spreadsheet
              </button>
              <button
                type="button"
                className={mode === 'manual' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setMode('manual')}
              >
                Enter manually
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              <strong>Basic plan:</strong> add games one row at a time below.{' '}
              <strong>Pro</strong> and <strong>Enterprise</strong> can import a CSV or Excel file — upgrade under{' '}
              <strong>Dashboard → Settings → Plan</strong>.
            </p>
          )}

          {canImport && mode === 'import' ? (
            <ScheduleImportPanel
              seasons={seasons}
              seasonTeams={seasonTeams}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          ) : (
            <>
              <div style={{ marginBottom: '14px' }}>
                <label className="label">Season</label>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="input"
                  style={{ maxWidth: '280px' }}
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                  overflowX: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 120px 100px 120px 36px',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    minWidth: '600px',
                  }}
                >
                    {['Home Team', 'Away Team', 'Date', 'Time', 'Location', ''].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  <div style={{ minWidth: '600px' }}>
                    {rows.map((row, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 120px 100px 120px 36px',
                          gap: '6px',
                          padding: '8px 12px',
                          borderTop: '0.5px solid var(--border-light)',
                          alignItems: 'center',
                        }}
                      >
                        <select
                          value={row.home_team_id}
                          onChange={(e) => updateRow(index, 'home_team_id', e.target.value)}
                          className="input"
                          style={{ padding: '5px 8px', fontSize: '12px' }}
                        >
                          <option value="">Select team...</option>
                          {seasonTeams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={row.away_team_id}
                          onChange={(e) => updateRow(index, 'away_team_id', e.target.value)}
                          className="input"
                          style={{ padding: '5px 8px', fontSize: '12px' }}
                        >
                          <option value="">Select team...</option>
                          {seasonTeams
                            .filter((t) => t.id !== row.home_team_id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>

                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(index, 'date', e.target.value)}
                          className="input"
                          style={{ padding: '5px 8px', fontSize: '12px' }}
                        />

                        <input
                          type="time"
                          value={row.time}
                          onChange={(e) => updateRow(index, 'time', e.target.value)}
                          className="input"
                          style={{ padding: '5px 8px', fontSize: '12px' }}
                        />

                        <input
                          type="text"
                          placeholder="Court 1"
                          value={row.location}
                          onChange={(e) => updateRow(index, 'location', e.target.value)}
                          className="input"
                          style={{ padding: '5px 8px', fontSize: '12px' }}
                        />

                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          disabled={rows.length === 1}
                          className="modal-close"
                          aria-label="Remove row"
                          style={{
                            color: rows.length === 1 ? 'var(--text-muted)' : undefined,
                            cursor: rows.length === 1 ? 'not-allowed' : 'pointer',
                            opacity: rows.length === 1 ? 0.45 : 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div style={{ padding: '8px 12px', borderTop: '0.5px solid var(--border-light)' }}>
                      <button
                        type="button"
                        onClick={addRow}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          padding: '0',
                        }}
                      >
                        + Add another game
                      </button>
                    </div>
                  </div>
              </div>

              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '0.5px solid #fecaca',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#dc2626',
                    marginBottom: '12px',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || validRows.length === 0}
                  className="btn-primary"
                >
                  {submitting
                    ? 'Scheduling...'
                    : `Schedule ${validRows.length > 0 ? validRows.length : ''} Game${validRows.length !== 1 ? 's' : ''} →`}
                </button>
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                {validRows.length > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {validRows.length} game{validRows.length !== 1 ? 's' : ''} ready
                  </span>
                )}
              </div>
            </>
          )}
    </div>
  )
}
