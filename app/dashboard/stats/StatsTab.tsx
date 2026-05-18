'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { DashboardPlanLockedHint } from '@/components/dashboard/DashboardPlanLockedHint'
import GameStatsImportPanel from './GameStatsImportPanel'
import GameBoxScorePanel from './GameBoxScorePanel'
import { isBasic, isProOrEnterprise, normalizeOrgPlan, type OrgPlanSlug } from '@/lib/org-plan-tier'

interface Season {
  id: string
  name: string
  is_active?: boolean
}

interface TeamOption {
  id: string
  name: string
}

interface Leader {
  player_name: string
  stat: string
  total: number
}

interface GameRow {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  scheduled_at: string | null
  location: string | null
  status: string
  home_score: number
  away_score: number
  home_team_name: string
  away_team_name: string
  stats_row_count: number
}

function formatWhen(iso: string | null) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function StatsTab() {
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [teamId, setTeamId] = useState('')
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [games, setGames] = useState<GameRow[]>([])
  const [plan, setPlan] = useState<OrgPlanSlug | null>(null)
  const [locked, setLocked] = useState(false)
  const [importGameId, setImportGameId] = useState<string | null>(null)
  const [boxScoreGameId, setBoxScoreGameId] = useState<string | null>(null)
  const [downloadingGameId, setDownloadingGameId] = useState<string | null>(null)

  const canUseStatsHub = plan !== null && isProOrEnterprise(plan)
  const statsLocked = plan !== null && (locked || isBasic(plan))

  async function fetchData(opts?: { seasonId?: string; teamId?: string }) {
    setLoading(true)
    const sid = opts?.seasonId ?? seasonId
    const tid = opts?.teamId !== undefined ? opts.teamId : teamId
    const params = new URLSearchParams()
    if (sid) params.set('season_id', sid)
    if (tid) params.set('team_id', tid)
    const q = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`/api/stats${q}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return
    setSeasons(data.seasons || [])
    setSeasonId(data.season_id || '')
    setTeams(data.teams || [])
    if (opts?.teamId !== undefined) setTeamId(opts.teamId)
    else if (data.team_id !== undefined) setTeamId(data.team_id || '')
    setLeaders(data.leaders || [])
    setGames(data.games || [])
    if (data.plan !== undefined) setPlan(normalizeOrgPlan(data.plan))
    setLocked(Boolean(data.locked))
  }

  useEffect(() => {
    void fetchData({ seasonId: '', teamId: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function downloadStatSheet(gameId: string) {
    setDownloadingGameId(gameId)
    try {
      const res = await fetch(`/api/games/${gameId}/stats/import/template?format=xlsx`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'game-stats.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingGameId(null)
    }
  }

  function closePanels() {
    setImportGameId(null)
    setBoxScoreGameId(null)
  }

  if (loading && seasons.length === 0 && !statsLocked) {
    return <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</p>
  }

  return (
    <div>
      {statsLocked ? (
        <DashboardPlanLockedHint feature="use the stats hub for season leaders, game history, and Excel import after games" />
      ) : null}
      <div style={{ opacity: statsLocked ? 0.55 : 1, pointerEvents: statsLocked ? 'none' : 'auto' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label className="label">Season</label>
          <select
            className="input"
            style={{ maxWidth: '280px', display: 'block' }}
            value={seasonId}
            disabled={loading}
            onChange={(e) => {
              closePanels()
              setTeamId('')
              void fetchData({ seasonId: e.target.value, teamId: '' })
            }}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {teams.length > 0 ? (
          <div>
            <label className="label">Team</label>
            <select
              className="input"
              style={{ maxWidth: '280px', display: 'block' }}
              value={teamId}
              disabled={loading}
              onChange={(e) => {
                closePanels()
                void fetchData({ teamId: e.target.value })
              }}
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Updating…</p>
      ) : null}

      {leaders.length > 0 ? (
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
            }}
          >
            <BarChart3 size={18} />
            Season leaders
            <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-muted)' }}>
              (final games{teamId ? ', this team' : ''})
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            {leaders.map((l) => (
              <div key={l.stat} className="stat-card" style={{ padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>{l.stat}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{l.total}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {l.player_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>
        Games with stats
        {teamId ? (
          <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            — filtered by team
          </span>
        ) : null}
      </div>

      {games.length === 0 && !loading ? (
        <div className="card" style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {teamId
            ? 'No live or final games for this team in this season.'
            : 'No live or final games in this season yet. Schedule games under '}
          {!teamId ? <Link href="/dashboard/games">Games</Link> : null}
          {!teamId ? ', then come back here.' : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {games.map((g) => {
            const label = `${g.away_team_name} @ ${g.home_team_name} — ${formatWhen(g.scheduled_at)}`
            const score =
              g.status === 'final' || g.status === 'live'
                ? `${g.away_score} – ${g.home_score}`
                : null
            const hasStats = g.stats_row_count > 0
            return (
              <div key={g.id} className="card" style={{ padding: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {g.away_team_name} <span style={{ color: 'var(--text-muted)' }}>@</span> {g.home_team_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {formatWhen(g.scheduled_at)}
                      {g.location ? ` · ${g.location}` : ''}
                      {score ? ` · ${score}` : ''}
                      {g.status === 'live' ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}> · LIVE</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {hasStats
                        ? `${g.stats_row_count} player stat row${g.stats_row_count !== 1 ? 's' : ''} recorded`
                        : 'No stats yet'}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      alignItems: 'flex-end',
                      minWidth: '148px',
                    }}
                  >
                    {hasStats ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px', width: '100%' }}
                        onClick={() => {
                          setImportGameId(null)
                          setBoxScoreGameId((cur) => (cur === g.id ? null : g.id))
                        }}
                      >
                        {boxScoreGameId === g.id ? 'Hide box score' : 'View box score'}
                      </button>
                    ) : null}
                    <Link
                      href={`/dashboard/games/${g.id}/scoring`}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none', width: '100%', textAlign: 'center' }}
                    >
                      {g.status === 'live' ? 'Live stats' : 'Enter stats'}
                    </Link>
                    {canUseStatsHub ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 12px', width: '100%' }}
                          disabled={downloadingGameId === g.id}
                          onClick={() => void downloadStatSheet(g.id)}
                        >
                          {downloadingGameId === g.id ? 'Downloading…' : 'Download stat sheet'}
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: '12px', padding: '6px 12px', width: '100%' }}
                          onClick={() => {
                            setBoxScoreGameId(null)
                            setImportGameId((cur) => (cur === g.id ? null : g.id))
                          }}
                        >
                          {importGameId === g.id ? 'Cancel import' : 'Import completed sheet'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {boxScoreGameId === g.id ? (
                  <GameBoxScorePanel
                    gameId={g.id}
                    gameLabel={label}
                    isLive={g.status === 'live'}
                    onClose={() => setBoxScoreGameId(null)}
                  />
                ) : null}
                {importGameId === g.id && canUseStatsHub ? (
                  <GameStatsImportPanel
                    gameId={g.id}
                    gameLabel={label}
                    onDownloadSheet={() => void downloadStatSheet(g.id)}
                    downloadingSheet={downloadingGameId === g.id}
                    onClose={() => setImportGameId(null)}
                    onSuccess={() => {
                      setImportGameId(null)
                      void fetchData()
                    }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
