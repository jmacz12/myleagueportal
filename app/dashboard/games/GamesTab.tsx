'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, CalendarDays, ExternalLink, Timer, Trophy } from 'lucide-react'
import AddGamesForm from './AddGamesForm'
import { contrastTextOnColor } from '@/lib/contrast-text-on-color'
import {
  PRIMARY_STAT_LABELS,
  PUBLIC_PRIMARY_STAT_ORDER,
  normalizePublicPrimaryStatKeys,
  type PublicPrimaryStatKey,
} from '@/lib/public-primary-stats'
import { normalizeOrgPlan, type OrgPlanSlug } from '@/lib/org-plan-tier'

const DEMO_LIVE_LOCATION = 'MLP_DEMO_LIVE_STREAM'

function primarySlotOptions(slotIndex: number, draft: PublicPrimaryStatKey[]) {
  const cur = draft[slotIndex]
  const usedElsewhere = new Set(draft.filter((_, j) => j !== slotIndex))
  return PUBLIC_PRIMARY_STAT_ORDER.filter((k) => k === cur || !usedElsewhere.has(k)).map((k) => ({
    value: k,
    label: PRIMARY_STAT_LABELS[k],
  }))
}

function formatGameLocation(location: string | null): string | null {
  if (!location) return null
  if (location === DEMO_LIVE_LOCATION) return 'Practice / stream demo'
  return location
}

interface Game {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  scheduled_at: string | null
  location: string | null
  home_score: number
  away_score: number
  status: string
  stream_url: string | null
  season_id: string
  period?: number | null
  game_clock?: string | null
}

interface Team { id: string; name: string; color: string | null }
interface Season { id: string; name: string }

export default function GamesTab() {
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'final'>('all')
  const [selectedSeason, setSelectedSeason] = useState('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [scoringQuarterMinutes, setScoringQuarterMinutes] = useState(10)
  const [scoringPrefsSaving, setScoringPrefsSaving] = useState(false)
  const [scoringPrefsError, setScoringPrefsError] = useState('')
  const [primaryDraft, setPrimaryDraft] = useState<PublicPrimaryStatKey[]>(() => [
    ...normalizePublicPrimaryStatKeys(null),
  ])
  const [statPicksDirty, setStatPicksDirty] = useState(false)
  const [statPicksSaving, setStatPicksSaving] = useState(false)
  const [statPicksError, setStatPicksError] = useState('')
  const [orgPlan, setOrgPlan] = useState<OrgPlanSlug | null>(null)

  useEffect(() => {
    void fetchData()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/games/scoring-preferences')
      const j = (await res.json().catch(() => null)) as {
        scoring_quarter_minutes?: number
        public_stream_primary_stat_keys?: unknown
        plan?: unknown
        error?: string
      } | null
      if (cancelled) return
      if (res.ok && j) {
        if (typeof j.scoring_quarter_minutes === 'number') {
          setScoringQuarterMinutes(j.scoring_quarter_minutes)
        }
        if (j.plan !== undefined) {
          setOrgPlan(normalizeOrgPlan(j.plan))
        }
        if (j.public_stream_primary_stat_keys !== undefined) {
          setPrimaryDraft([...normalizePublicPrimaryStatKeys(j.public_stream_primary_stat_keys)])
          setStatPicksDirty(false)
        }
        setScoringPrefsError('')
      } else if (j?.error) {
        setScoringPrefsError(j.error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Keep the list in sync with the scoring page (and public overlay) while you practice. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchData()
    }, 3000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchData()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  async function updateScoringQuarterMinutes(next: number) {
    setScoringPrefsError('')
    setScoringPrefsSaving(true)
    setScoringQuarterMinutes(next)
    try {
      const res = await fetch('/api/games/scoring-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoring_quarter_minutes: next }),
      })
      const j = (await res.json().catch(() => null)) as { scoring_quarter_minutes?: number; error?: string } | null
      if (!res.ok) {
        setScoringPrefsError(typeof j?.error === 'string' ? j.error : 'Could not save quarter length')
        const reload = await fetch('/api/games/scoring-preferences')
        const rj = (await reload.json().catch(() => null)) as { scoring_quarter_minutes?: number } | null
        if (reload.ok && rj && typeof rj.scoring_quarter_minutes === 'number') {
          setScoringQuarterMinutes(rj.scoring_quarter_minutes)
        }
        return
      }
      if (j && typeof j.scoring_quarter_minutes === 'number') {
        setScoringQuarterMinutes(j.scoring_quarter_minutes)
      }
    } finally {
      setScoringPrefsSaving(false)
    }
  }

  async function saveStatPicks() {
    setStatPicksError('')
    setStatPicksSaving(true)
    try {
      const normalized = normalizePublicPrimaryStatKeys(primaryDraft)
      setPrimaryDraft([...normalized])
      const res = await fetch('/api/games/scoring-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_stream_primary_stat_keys: normalized }),
      })
      const j = (await res.json().catch(() => null)) as {
        public_stream_primary_stat_keys?: unknown
        error?: string
      } | null
      if (!res.ok) {
        setStatPicksError(typeof j?.error === 'string' ? j.error : 'Could not save stat picks')
        return
      }
      if (j?.public_stream_primary_stat_keys !== undefined) {
        setPrimaryDraft([...normalizePublicPrimaryStatKeys(j.public_stream_primary_stat_keys)])
      }
      setStatPicksDirty(false)
    } finally {
      setStatPicksSaving(false)
    }
  }

  async function fetchData() {
    const [gamesRes, teamsRes, seasonsRes] = await Promise.all([
      fetch('/api/games'),
      fetch('/api/teams'),
      fetch('/api/seasons'),
    ])
    const [gd, td, sd] = await Promise.all([
      gamesRes.json(), teamsRes.json(), seasonsRes.json()
    ])
    setGames(gd.games || [])
    setTeams(td.teams || [])
    setSeasons(sd.seasons || [])
    setLoading(false)
  }

  async function deleteGame(gameId: string) {
    if (!confirm('Delete this game?')) return
    setDeletingId(gameId)
    await fetch('/api/games', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId }),
    })
    setDeletingId(null)
    fetchData()
  }

  async function updateStatus(gameId: string, status: string) {
    await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, status }),
    })
    fetchData()
  }

  function goToScoring(gameId: string) {
    window.location.href = '/dashboard/games/' + gameId + '/scoring'
  }

  const getTeam = (id: string | null) => teams.find(t => t.id === id)

  const filtered = useMemo(() => {
    const rows = games.filter((g) => {
      const statusMatch = filter === 'all' || g.status === filter
      const seasonMatch = selectedSeason === 'all' || g.season_id === selectedSeason
      return statusMatch && seasonMatch
    })
    return [...rows].sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1
      if (a.status !== 'live' && b.status === 'live') return 1
      const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      return ta - tb
    })
  }, [games, filter, selectedSeason])

  const demoLiveGame = useMemo(
    () => games.find((g) => g.status === 'live' && g.location === DEMO_LIVE_LOCATION),
    [games]
  )

  const grouped = filtered.reduce((acc, game) => {
    const date = game.scheduled_at
      ? new Date(game.scheduled_at).toLocaleDateString('en-CA', {
          weekday: 'long', month: 'long', day: 'numeric'
        })
      : 'No Date Set'
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, Game[]>)

  const statusStyle = (status: string) => {
    if (status === 'live') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' }
    if (status === 'final') return { background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0' }
    return { background: '#fffbeb', color: '#92400e', border: '0.5px solid #fde68a' }
  }

  const statusLabel = (status: string) => {
    if (status === 'live') return 'Live'
    if (status === 'final') return 'Final'
    return 'Scheduled'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {games.length} game{games.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + Add Games
          </button>
        </div>
      </div>

      {showForm && (
        <AddGamesForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchData() }}
        />
      )}

      <div
        style={{
          marginBottom: '18px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--surface-elevated, #fafafa)',
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <Timer size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden />
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Minutes per quarter (scoring)
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
            Used for the game clock and <strong>minutes played</strong> on the score sheet. If you change this, we recalc minutes for every game in your league (can take a moment).
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ maxWidth: '200px' }}
              value={scoringQuarterMinutes}
              disabled={scoringPrefsSaving}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!Number.isFinite(v)) return
                void updateScoringQuarterMinutes(v)
              }}
            >
              {Array.from({ length: 20 - 4 + 1 }, (_, i) => i + 4).map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
            {scoringPrefsSaving ? (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saving…</span>
            ) : null}
          </div>
          {scoringPrefsError ? (
            <p style={{ fontSize: '12px', color: '#dc2626', margin: '8px 0 0' }}>{scoringPrefsError}</p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginBottom: '18px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--surface-elevated, #fafafa)',
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <BarChart3 size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden />
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Public stats (Pro &amp; Enterprise)
          </div>
          {orgPlan === null ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>Loading plan…</p>
          ) : orgPlan === 'basic' ? (
            <>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                <strong>Basic:</strong> the public <strong>Stream</strong> box score shows <strong>roster only</strong> (no per-player stat
                columns on the public site). Your score sheet still records full stats. Upgrade to <strong>Pro</strong> or{' '}
                <strong>Enterprise</strong> to show public stat columns on the Stream tab and public team pages.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                Change plan under <strong>Dashboard → Settings</strong>.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                Choose <strong>five</strong> headline columns for the <strong>league Stream</strong> box score and <strong>public team</strong>{' '}
                season table — they always appear <strong>first (left)</strong> on those public pages. On <strong>Pro</strong>, other columns show as{' '}
                <strong>locked</strong> until <strong>Enterprise</strong>, which shows the full grid.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '10px 12px',
                  marginBottom: '12px',
                }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Column {i + 1}</span>
                    <select
                      className="input"
                      value={primaryDraft[i]}
                      disabled={statPicksSaving}
                      onChange={(e) => {
                        const v = e.target.value as PublicPrimaryStatKey
                        setPrimaryDraft((d) => {
                          const n = [...d]
                          n[i] = v
                          return n
                        })
                        setStatPicksDirty(true)
                      }}
                    >
                      {primarySlotOptions(i, primaryDraft).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={statPicksSaving || !statPicksDirty}
                  onClick={() => void saveStatPicks()}
                >
                  {statPicksSaving ? 'Saving…' : 'Save stat picks'}
                </button>
                {statPicksError ? (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{statPicksError}</span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {demoLiveGame ? (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid #fecaca',
            background: '#fff7f7',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--text-primary)',
          }}
        >
          <strong>Practice stream demo is live.</strong> Use <strong>Stats</strong> below to open scoring — the list refreshes every few seconds, and the public{' '}
          <a
            href={`/games/${demoLiveGame.id}/stream-preview`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 700, color: 'var(--accent)' }}
          >
            stream preview
          </a>{' '}
          /{' '}
          <a href={`/games/${demoLiveGame.id}/overlay`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'var(--accent)' }}>
            overlay
          </a>{' '}
          update with the same scores.
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {(['all', 'scheduled', 'live', 'final'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px',
              borderRadius: '99px',
              fontSize: '12px',
              fontWeight: '600',
              border: filter === f ? '1.5px solid var(--btn-primary-bg)' : '1.5px solid var(--border)',
              cursor: 'pointer',
              background: filter === f ? 'var(--btn-primary-bg)' : 'transparent',
              color: filter === f ? 'var(--btn-primary-text)' : 'var(--text-primary)',
              fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="input"
          style={{ width: 'auto', padding: '5px 12px', fontSize: '12px', marginLeft: '8px' }}
        >
          <option value="all">All Seasons</option>
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading games...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarDays size={32} strokeWidth={1.5} /></div>
          <div className="empty-state-title">No games yet</div>
          <div className="empty-state-desc">Click &quot;+ Add Games&quot; to schedule your first game.</div>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateGames]) => (
          <div key={date} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {date}
              </span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dateGames.map((game) => {
                const homeTeam = getTeam(game.home_team_id)
                const awayTeam = getTeam(game.away_team_id)
                const homeChip = homeTeam?.color?.trim()
                  ? {
                      background: homeTeam.color,
                      color: contrastTextOnColor(homeTeam.color),
                      border: '2px solid rgba(0,0,0,0.14)',
                    }
                  : {
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                    }
                const awayChip = awayTeam?.color?.trim()
                  ? {
                      background: awayTeam.color,
                      color: contrastTextOnColor(awayTeam.color),
                      border: '2px solid rgba(0,0,0,0.14)',
                    }
                  : {
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                    }
                const time = game.scheduled_at
                  ? new Date(game.scheduled_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
                  : ''

                return (
                  <div
                    key={game.id}
                    className="card-sm"
                    style={{
                      borderColor: game.status === 'live' ? '#fecaca' : game.status === 'final' ? '#bbf7d0' : 'var(--border)',
                      background: game.status === 'live' ? '#fff9f9' : 'var(--bg-surface)',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(80px, 96px) minmax(0, 1fr) auto',
                        alignItems: 'center',
                        columnGap: '12px',
                        rowGap: '10px',
                      }}
                    >

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, justifySelf: 'start' }}>
                        <span style={{
                          ...statusStyle(game.status),
                          borderRadius: '99px', fontSize: '10px', fontWeight: '700',
                          padding: '2px 8px', display: 'inline-block', textAlign: 'center',
                        }}>
                          {statusLabel(game.status)}
                        </span>
                        {time && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            {time}
                          </span>
                        )}
                        {formatGameLocation(game.location) && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            {formatGameLocation(game.location)}
                          </span>
                        )}
                        {game.status === 'live' && (game.period != null || game.game_clock) && (
                          <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, textAlign: 'center' }}>
                            Q{game.period ?? 1} · {game.game_clock || '0:00'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', minWidth: 0 }}>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {homeTeam?.color && (
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: homeTeam.color, flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {homeTeam?.name || 'TBD'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {game.status !== 'scheduled' ? (
                            <>
                              <div
                                style={{
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '16px',
                                  fontWeight: '800',
                                  fontFamily: 'monospace',
                                  minWidth: '36px',
                                  textAlign: 'center',
                                  ...homeChip,
                                }}
                              >
                                {game.home_score}
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>—</span>
                              <div
                                style={{
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '16px',
                                  fontWeight: '800',
                                  fontFamily: 'monospace',
                                  minWidth: '36px',
                                  textAlign: 'center',
                                  ...awayChip,
                                }}
                              >
                                {game.away_score}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: '6px', padding: '4px 10px', fontSize: '14px', fontWeight: '800', minWidth: '36px', textAlign: 'center' }}>—</div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>vs</span>
                              <div style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: '6px', padding: '4px 10px', fontSize: '14px', fontWeight: '800', minWidth: '36px', textAlign: 'center' }}>—</div>
                            </>
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {awayTeam?.color && (
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: awayTeam.color, flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {awayTeam?.name || 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          justifySelf: 'end',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          flexWrap: 'nowrap',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap' }}>
                          {game.status === 'scheduled' && (
                            <button
                              onClick={() => updateStatus(game.id, 'live')}
                              style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Start Live
                            </button>
                          )}

                          {game.status === 'live' && (
                            <>
                              <button
                                onClick={() => goToScoring(game.id)}
                                style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                              >
                                <BarChart3 size={14} strokeWidth={2} aria-hidden />
                                Stats
                              </button>
                              <a
                                href={`/games/${game.id}/stream-preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'var(--bg-elevated)',
                                  border: '0.5px solid var(--border)',
                                  borderRadius: '6px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  fontFamily: 'inherit',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <ExternalLink size={14} aria-hidden />
                                Preview
                              </a>
                              <button
                                onClick={() => updateStatus(game.id, 'final')}
                                style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                              >
                                End Game
                              </button>
                            </>
                          )}

                          {game.status === 'final' && (
                            <button
                              onClick={() => goToScoring(game.id)}
                              style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                            >
                              <Trophy size={14} strokeWidth={2} aria-hidden />
                              Highlights
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => deleteGame(game.id)}
                          disabled={deletingId === game.id}
                          style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === game.id ? 0.5 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                          {deletingId === game.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}