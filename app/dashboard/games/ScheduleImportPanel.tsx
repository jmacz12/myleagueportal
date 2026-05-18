'use client'

import { useRef, useState } from 'react'
import {
  applyScheduleImportDuplicateWarnings,
  previewRowsToConfirmGames,
  refreshScheduleImportPreviewRow,
  type ScheduleImportPreviewRow,
  type TeamNameLookup,
} from '@/lib/games-schedule-csv'

interface Season {
  id: string
  name: string
}

interface Team {
  id: string
  name: string
  season_id: string
}

interface Props {
  seasons: Season[]
  seasonTeams: Team[]
  selectedSeason: string
  onSeasonChange: (id: string) => void
  onClose: () => void
  onSuccess: () => void
}

type ConfirmGameRow = {
  home_team_id: string
  away_team_id: string
  date: string
  time: string
  location: string
}

function rowNeedsTeamPick(row: ScheduleImportPreviewRow): boolean {
  return (
    !row.ready &&
    (!row.home_team_id ||
      !row.away_team_id ||
      row.errors.some((e) => /team/i.test(e) || /pick the/i.test(e)))
  )
}

function rowNeedsDateFix(row: ScheduleImportPreviewRow): boolean {
  return !row.ready && row.errors.some((e) => /date|time/i.test(e))
}

function applyPreviewState(rows: ScheduleImportPreviewRow[]) {
  const finalized = applyScheduleImportDuplicateWarnings(rows)
  const { games, readyCount } = previewRowsToConfirmGames(finalized)
  return { rows: finalized, games, readyCount }
}

export default function ScheduleImportPanel({
  seasons,
  seasonTeams,
  selectedSeason,
  onSeasonChange,
  onClose,
  onSuccess,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<ScheduleImportPreviewRow[] | null>(null)
  const [confirmGames, setConfirmGames] = useState<ConfirmGameRow[]>([])
  const [readyCount, setReadyCount] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<'csv' | 'xlsx' | null>(null)
  const [showDownloadPicker, setShowDownloadPicker] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const teamLookup: TeamNameLookup[] = seasonTeams.map((t) => ({ id: t.id, name: t.name }))

  function commitPreviewRows(rows: ScheduleImportPreviewRow[]) {
    const { rows: finalized, games, readyCount: ready } = applyPreviewState(rows)
    setPreviewRows(finalized)
    setConfirmGames(games)
    setReadyCount(ready)
  }

  function resetPreview() {
    setPreviewRows(null)
    setConfirmGames([])
    setReadyCount(0)
  }

  async function downloadTemplate(format: 'csv' | 'xlsx') {
    if (!selectedSeason) {
      setError('Choose a season first.')
      setShowDownloadPicker(false)
      return
    }
    setDownloading(format)
    setError('')
    try {
      const res = await fetch(
        `/api/games/import/template?season_id=${encodeURIComponent(selectedSeason)}&format=${format}`
      )
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError((j as { error?: string } | null)?.error || 'Could not download template')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `schedule-template.${format === 'xlsx' ? 'xlsx' : 'csv'}`
      a.click()
      URL.revokeObjectURL(url)
      setShowDownloadPicker(false)
    } finally {
      setDownloading(null)
    }
  }

  async function handleReview() {
    if (!selectedSeason) {
      setError('Choose a season first.')
      return
    }
    if (!uploadedFile) {
      setError('Upload your spreadsheet (.csv / .xlsx) or calendar file (.ics) first.')
      return
    }

    setLoading(true)
    setError('')
    resetPreview()

    const form = new FormData()
    form.append('season_id', selectedSeason)
    form.append('file', uploadedFile)

    const res = await fetch('/api/games/import', { method: 'POST', body: form })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not read that schedule')
      return
    }

    const rows: ScheduleImportPreviewRow[] = data.rows || []
    commitPreviewRows(rows)
    setTruncated(Boolean(data.truncated))
  }

  function updateRowTeam(lineNumber: number, side: 'home' | 'away', teamId: string) {
    if (!previewRows) return
    const row = previewRows.find((r) => r.lineNumber === lineNumber)
    if (!row) return

    const manual = {
      home_team_id: side === 'home' ? teamId : row.home_team_id ?? undefined,
      away_team_id: side === 'away' ? teamId : row.away_team_id ?? undefined,
    }
    const updated = refreshScheduleImportPreviewRow(row, teamLookup, manual)
    commitPreviewRows(previewRows.map((r) => (r.lineNumber === lineNumber ? updated : r)))
  }

  function updateRowField(lineNumber: number, field: 'date' | 'time', value: string) {
    if (!previewRows) return
    const row = previewRows.find((r) => r.lineNumber === lineNumber)
    if (!row) return

    const patched = { ...row, [field]: value }
    const manual = {
      home_team_id: row.home_team_id ?? undefined,
      away_team_id: row.away_team_id ?? undefined,
    }
    const updated = refreshScheduleImportPreviewRow(patched, teamLookup, manual)
    commitPreviewRows(previewRows.map((r) => (r.lineNumber === lineNumber ? updated : r)))
  }

  async function handleConfirm() {
    if (!previewRows || confirmGames.length === 0) return
    setConfirming(true)
    setError('')

    const res = await fetch('/api/games/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: selectedSeason,
        confirm: true,
        games: confirmGames,
      }),
    })
    const data = await res.json()
    setConfirming(false)

    if (!res.ok) {
      setError(data.error || 'Import failed')
      return
    }

    onSuccess()
  }

  function handleFileChange(file: File | null) {
    if (!file) return
    setUploadedFile(file)
    resetPreview()
    setError('')
  }

  const issueCount = previewRows ? previewRows.length - readyCount : 0

  function renderTeamCell(row: ScheduleImportPreviewRow, side: 'home' | 'away') {
    const needsPick = rowNeedsTeamPick(row)
    const teamId = side === 'home' ? row.home_team_id : row.away_team_id
    const label = side === 'home' ? row.home_team_label ?? row.home_team : row.away_team_label ?? row.away_team
    const typed = side === 'home' ? row.home_team : row.away_team

    if (needsPick && !teamId) {
      return (
        <div>
          {typed.trim() ? (
            <div style={{ fontSize: '10px', color: '#b45309', marginBottom: '4px', lineHeight: 1.3 }}>
              In file: “{typed.trim()}”
            </div>
          ) : null}
          <select
            value=""
            onChange={(e) => updateRowTeam(row.lineNumber, side, e.target.value)}
            className="input"
            style={{ padding: '4px 6px', fontSize: '11px', width: '100%', minWidth: 120 }}
            aria-label={`Pick ${side} team for row ${row.lineNumber}`}
          >
            <option value="">Pick team…</option>
            {seasonTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (needsPick && teamId) {
      return (
        <select
          value={teamId}
          onChange={(e) => updateRowTeam(row.lineNumber, side, e.target.value)}
          className="input"
          style={{ padding: '4px 6px', fontSize: '11px', width: '100%', minWidth: 120 }}
          aria-label={`${side} team for row ${row.lineNumber}`}
        >
          {seasonTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )
    }

    return <span>{label}</span>
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label className="label">Season</label>
        <select
          value={selectedSeason}
          onChange={(e) => {
            onSeasonChange(e.target.value)
            resetPreview()
            setUploadedFile(null)
            if (fileRef.current) fileRef.current.value = ''
          }}
          className="input"
          style={{ maxWidth: '280px' }}
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {seasonTeams.length < 2 ? (
          <p style={{ fontSize: '12px', color: '#b45309', marginTop: '8px', lineHeight: 1.45 }}>
            Add at least <strong>two teams</strong> to this season (Dashboard → Teams) so team names in your file
            can match.
          </p>
        ) : null}
      </div>

      {!previewRows ? (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Download <strong>Excel</strong> and fill the <strong>Schedule</strong> tab, or export your season from{' '}
            <strong>Google Calendar / Apple Calendar</strong> as <strong>.ics</strong>. Event titles should look like{' '}
            <strong>Home vs Away</strong> or <strong>Away @ Home</strong>. A few games? Use{' '}
            <strong>Enter manually</strong> instead.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: uploadedFile ? '8px' : '14px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, minWidth: 0 }}
              disabled={downloading !== null}
              onClick={() => setShowDownloadPicker(true)}
            >
              Download template
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1, minWidth: 0 }}
              onClick={() => fileRef.current?.click()}
            >
              Upload file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.ics,.ical,text/csv,text/calendar,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {uploadedFile ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px', textAlign: 'center' }}>
              Selected: <strong>{uploadedFile.name}</strong>
            </p>
          ) : null}

          {showDownloadPicker ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-template-download-title"
              onClick={(e) => {
                if (e.target === e.currentTarget && downloading === null) setShowDownloadPicker(false)
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                padding: '16px',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '14px',
                  padding: '20px',
                  maxWidth: '360px',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    id="schedule-template-download-title"
                    style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}
                  >
                    Download template
                  </div>
                  <button
                    type="button"
                    className="modal-close"
                    aria-label="Close"
                    disabled={downloading !== null}
                    onClick={() => setShowDownloadPicker(false)}
                  >
                    ×
                  </button>
                </div>
                {seasonTeams.length < 2 ? (
                  <p style={{ fontSize: '12px', color: '#b45309', margin: '0 0 16px', lineHeight: 1.45 }}>
                    Add at least two teams to this season first, then download again.
                  </p>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '100%' }}
                    disabled={downloading !== null}
                    onClick={() => void downloadTemplate('xlsx')}
                  >
                    {downloading === 'xlsx' ? 'Downloading…' : 'Excel (.xlsx)'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%' }}
                    disabled={downloading !== null}
                    onClick={() => void downloadTemplate('csv')}
                  >
                    {downloading === 'csv' ? 'Downloading…' : 'CSV'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%', marginTop: '4px' }}
                    disabled={downloading !== null}
                    onClick={() => setShowDownloadPicker(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
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
          ) : null}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleReview()}
              disabled={loading || !uploadedFile}
            >
              {loading ? 'Checking…' : 'Review schedule'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              background: issueCount > 0 ? '#fffbeb' : '#ecfdf5',
              border: `0.5px solid ${issueCount > 0 ? '#fcd34d' : '#6ee7b7'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              marginBottom: '12px',
              lineHeight: 1.5,
            }}
          >
            {issueCount > 0 ? (
              <>
                <strong>{issueCount}</strong> game{issueCount !== 1 ? 's' : ''} need a fix before scheduling.
                Pick teams from the lists on rows marked <strong>!</strong> — you don&apos;t need to re-upload the
                file.
              </>
            ) : (
              <>
                All <strong>{readyCount}</strong> game{readyCount !== 1 ? 's' : ''} look good. Each one is linked to
                your real teams (and their players).
              </>
            )}
          </div>

          <div style={{ fontSize: '13px', marginBottom: '10px', color: 'var(--text-primary)' }}>
            <strong>{readyCount}</strong> of {previewRows.length} game{previewRows.length !== 1 ? 's' : ''} ready
          </div>

          {truncated ? (
            <p style={{ fontSize: '12px', color: '#b45309', marginBottom: '10px', lineHeight: 1.45 }}>
              Only the first <strong>100</strong> games in your file were checked. Split larger schedules or import in
              batches.
            </p>
          ) : null}

          <div
            style={{
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '320px',
              marginBottom: '12px',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                  {['', 'Home', 'Away', 'When', 'Place', 'Notes'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        fontWeight: 700,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.lineNumber}
                    style={{
                      borderTop: '0.5px solid var(--border-light)',
                      background: row.ready ? undefined : 'rgba(254, 242, 242, 0.35)',
                    }}
                  >
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>{row.ready ? '✓' : '!'}</td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top', minWidth: 130 }}>
                      {renderTeamCell(row, 'home')}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top', minWidth: 130 }}>
                      {renderTeamCell(row, 'away')}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {rowNeedsDateFix(row) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <input
                            type="date"
                            value={/^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : ''}
                            onChange={(e) => updateRowField(row.lineNumber, 'date', e.target.value)}
                            className="input"
                            style={{ padding: '4px 6px', fontSize: '11px' }}
                            aria-label={`Date for row ${row.lineNumber}`}
                          />
                          <input
                            type="time"
                            value={/^\d{2}:\d{2}$/.test(row.time) ? row.time : ''}
                            onChange={(e) => updateRowField(row.lineNumber, 'time', e.target.value)}
                            className="input"
                            style={{ padding: '4px 6px', fontSize: '11px' }}
                            aria-label={`Time for row ${row.lineNumber}`}
                          />
                        </div>
                      ) : (
                        <>
                          {row.date} {row.time}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>{row.location || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#b45309', maxWidth: 200, fontSize: '11px', verticalAlign: 'top' }}>
                      {[...row.errors, ...row.warnings].join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? (
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
          ) : null}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleConfirm()}
              disabled={confirming || confirmGames.length === 0}
            >
              {confirming
                ? 'Scheduling…'
                : `Schedule ${confirmGames.length} game${confirmGames.length !== 1 ? 's' : ''}`}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                resetPreview()
                setError('')
              }}
            >
              Back
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
