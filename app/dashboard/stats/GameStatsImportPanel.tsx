'use client'

import { useRef, useState } from 'react'
import type { StatSheetPreviewRow } from '@/lib/game-stats-sheet-csv'

type ConfirmRow = {
  player_id: string
  fg2m: number
  fg3m: number
  ftm: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
}

interface Props {
  gameId: string
  gameLabel: string
  onDownloadSheet: () => void
  downloadingSheet?: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function GameStatsImportPanel({
  gameId,
  gameLabel,
  onDownloadSheet,
  downloadingSheet = false,
  onClose,
  onSuccess,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<StatSheetPreviewRow[] | null>(null)
  const [confirmRows, setConfirmRows] = useState<ConfirmRow[]>([])
  const [readyCount, setReadyCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  function resetPreview() {
    setPreviewRows(null)
    setConfirmRows([])
    setReadyCount(0)
  }

  async function handleReview() {
    if (!uploadedFile) {
      setError('Choose your filled-in Excel file first.')
      return
    }
    setLoading(true)
    setError('')
    resetPreview()

    const form = new FormData()
    form.append('file', uploadedFile)

    const res = await fetch(`/api/games/${gameId}/stats/import`, { method: 'POST', body: form })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not read that file')
      return
    }

    const rows: StatSheetPreviewRow[] = data.rows || []
    setPreviewRows(rows)
    setReadyCount(data.readyCount ?? 0)
    setConfirmRows(
      rows
        .filter((r) => r.ready && r.player_id && r.resolved)
        .map((r) => ({
          player_id: r.player_id!,
          ...r.resolved!,
        }))
    )
  }

  async function handleConfirm() {
    if (!confirmRows.length) return
    setConfirming(true)
    setError('')

    const res = await fetch(`/api/games/${gameId}/stats/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true, players: confirmRows }),
    })
    const data = await res.json()
    setConfirming(false)

    if (!res.ok) {
      setError(data.error || 'Save failed')
      return
    }
    onSuccess()
  }

  const issueCount = previewRows ? previewRows.length - readyCount : 0

  return (
    <div
      className="card"
      style={{ marginTop: '12px', padding: '16px', border: '0.5px solid var(--border)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
            Import completed stat sheet
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{gameLabel}</div>
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      {!previewRows ? (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            After the game, upload the Excel file you filled in offline. We&apos;ll check each row before saving.
          </p>
          <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
            Choose completed file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              if (!f) return
              setUploadedFile(f)
              resetPreview()
              setError('')
            }}
          />
          {uploadedFile ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', marginBottom: '12px' }}>
              Selected: <strong>{uploadedFile.name}</strong>
            </p>
          ) : (
            <div style={{ marginBottom: '12px' }} />
          )}
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
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !uploadedFile}
            onClick={() => void handleReview()}
          >
            {loading ? 'Checking…' : 'Review & save'}
          </button>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
            Need a blank sheet?{' '}
            <button
              type="button"
              onClick={onDownloadSheet}
              disabled={downloadingSheet}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--accent)',
                fontWeight: 600,
                cursor: downloadingSheet ? 'wait' : 'pointer',
                fontSize: '12px',
              }}
            >
              {downloadingSheet ? 'Downloading…' : 'Download stat sheet'}
            </button>
          </p>
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
              marginBottom: '12px',
              lineHeight: 1.5,
            }}
          >
            {issueCount > 0 ? (
              <>
                <strong>{issueCount}</strong> row{issueCount !== 1 ? 's' : ''} need a fix. Rows marked{' '}
                <strong>!</strong> won&apos;t be saved until corrected in the file and re-uploaded.
              </>
            ) : (
              <>
                <strong>{readyCount}</strong> player{readyCount !== 1 ? 's' : ''} ready to save.
              </>
            )}
          </div>

          <div
            style={{
              overflow: 'auto',
              maxHeight: '260px',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['', 'Player', 'PTS', 'REB', 'AST', 'Notes'].map((h) => (
                    <th key={h} style={{ padding: '8px', textAlign: 'left', fontSize: '10px' }}>
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
                      background: row.ready ? undefined : 'rgba(254,242,242,0.35)',
                    }}
                  >
                    <td style={{ padding: '8px' }}>{row.ready ? '✓' : '!'}</td>
                    <td style={{ padding: '8px' }}>
                      {row.player_label ?? row.player_name}
                      {row.team_side ? (
                        <span style={{ color: 'var(--text-muted)' }}> ({row.team_side})</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '8px' }}>{row.resolved?.pts ?? '—'}</td>
                    <td style={{ padding: '8px' }}>{row.resolved?.reb ?? '—'}</td>
                    <td style={{ padding: '8px' }}>{row.resolved?.ast ?? '—'}</td>
                    <td style={{ padding: '8px', color: '#b45309', maxWidth: 160 }}>
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
              disabled={confirming || confirmRows.length === 0}
              onClick={() => void handleConfirm()}
            >
              {confirming
                ? 'Saving…'
                : `Save stats for ${confirmRows.length} player${confirmRows.length !== 1 ? 's' : ''}`}
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
          </div>
        </>
      )}
    </div>
  )
}
