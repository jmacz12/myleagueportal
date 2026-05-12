'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'

type EditorRow = {
  id: string
  clerk_user_id: string
  invited_email: string | null
  created_at: string
}

type TeamStreamRow = { id: string; name: string; stream_url: string | null }

type Props = {
  slug: string
  editors: EditorRow[]
  editorEmail: string
  setEditorEmail: (v: string) => void
  addEditor: () => Promise<void>
  removeEditor: (clerkUserId: string) => Promise<void>
  editorBusy: boolean
}

export function LeagueSiteAccessPanel({
  slug,
  editors,
  editorEmail,
  setEditorEmail,
  addEditor,
  removeEditor,
  editorBusy,
}: Props) {
  const [streamLoading, setStreamLoading] = useState(true)
  const [streamSaving, setStreamSaving] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [streamMessage, setStreamMessage] = useState('')
  const [defaultStream, setDefaultStream] = useState('')
  const [teamRows, setTeamRows] = useState<TeamStreamRow[]>([])

  const loadStreams = useCallback(async () => {
    setStreamLoading(true)
    setStreamError('')
    try {
      const res = await fetch('/api/league-streams')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStreamError(typeof data.error === 'string' ? data.error : 'Could not load stream settings')
        return
      }
      setDefaultStream(typeof data.defaultStreamUrl === 'string' ? data.defaultStreamUrl : '')
      setTeamRows(Array.isArray(data.teams) ? data.teams : [])
    } finally {
      setStreamLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStreams()
  }, [loadStreams])

  async function saveStreams() {
    setStreamSaving(true)
    setStreamError('')
    setStreamMessage('')
    try {
      const res = await fetch('/api/league-streams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultStreamUrl: defaultStream.trim() || null,
          teamStreams: teamRows.map((t) => ({ teamId: t.id, streamUrl: t.stream_url })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStreamError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      setStreamMessage('Stream links saved.')
      await loadStreams()
    } finally {
      setStreamSaving(false)
    }
  }

  async function applyDefaultToAllTeams() {
    setStreamSaving(true)
    setStreamError('')
    setStreamMessage('')
    try {
      const res = await fetch('/api/league-streams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultStreamUrl: defaultStream.trim() || null,
          applyDefaultToAllTeams: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStreamError(typeof data.error === 'string' ? data.error : 'Apply failed')
        return
      }
      setStreamMessage('League URL applied to every team.')
      await loadStreams()
    } finally {
      setStreamSaving(false)
    }
  }

  const watchOnlyUrl = slug ? `/league/${slug}/stream` : ''

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <section
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '0.5px solid var(--sidebar-border)',
          borderRadius: '12px',
          padding: '18px',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px' }}>Live streams</h2>
        <p style={{ fontSize: '13px', color: 'var(--sidebar-text)', margin: '0 0 12px', lineHeight: 1.45 }}>
          Used when a game is <strong>live</strong> on the public league <strong>Stream</strong> tab (and the watch-only link below). Team URLs override the league default for that matchup; if both teams are blank, the league default is used.
        </p>
        {watchOnlyUrl ? (
          <p style={{ fontSize: '13px', margin: '0 0 14px' }}>
            <Link
              href={watchOnlyUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                color: 'var(--sidebar-active-border)',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={16} aria-hidden /> Open watch-only page ({watchOnlyUrl})
            </Link>
          </p>
        ) : null}
        {streamMessage ? (
          <p style={{ fontSize: '13px', color: '#15803d', marginBottom: '10px' }}>{streamMessage}</p>
        ) : null}
        {streamError ? <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '10px' }}>{streamError}</p> : null}

        {streamLoading ? (
          <p style={{ fontSize: '13px', color: 'var(--sidebar-text)' }}>Loading stream settings…</p>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--sidebar-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '6px',
                }}
              >
                League default (YouTube / Twitch watch URL)
              </div>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={defaultStream}
                onChange={(e) => setDefaultStream(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--sidebar-border)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '8px 0 0', lineHeight: 1.45 }}>
                <strong>Apply to all teams</strong> copies the league URL above onto every team (and saves that league default). Use <strong>Save stream links</strong> first if you only changed per-team rows.
              </p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--sidebar-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '8px',
                }}
              >
                Per team
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {teamRows.map((t) => (
                  <div key={t.id}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: 'var(--sidebar-text-active)' }}>
                      {t.name}
                    </div>
                    <input
                      type="url"
                      placeholder="Team stream URL (optional)"
                      value={t.stream_url ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setTeamRows((rows) => rows.map((r) => (r.id === t.id ? { ...r, stream_url: v } : r)))
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--sidebar-border)',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                disabled={streamSaving}
                onClick={() => void saveStreams()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--sidebar-active-border)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: streamSaving ? 'wait' : 'pointer',
                }}
              >
                {streamSaving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
                {streamSaving ? 'Saving…' : 'Save stream links'}
              </button>
              <button
                type="button"
                disabled={streamSaving || !defaultStream.trim()}
                onClick={() => void applyDefaultToAllTeams()}
                title={!defaultStream.trim() ? 'Enter a league default URL first' : undefined}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--sidebar-border)',
                  background: 'var(--bg-elevated, #fff)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: streamSaving || !defaultStream.trim() ? 'not-allowed' : 'pointer',
                  opacity: !defaultStream.trim() ? 0.55 : 1,
                }}
              >
                Apply league URL to all teams
              </button>
            </div>
          </>
        )}
      </section>

      <section
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '0.5px solid var(--sidebar-border)',
          borderRadius: '12px',
          padding: '18px',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px' }}>Website editors</h2>
        <p style={{ fontSize: '13px', color: 'var(--sidebar-text)', margin: '0 0 12px', lineHeight: 1.45 }}>
          Invite someone by the email they use with their Clerk account. They must sign up once before you can add them.
          Editors can update the league website only (not billing or other dashboard areas).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <input
            type="email"
            placeholder="editor@email.com"
            value={editorEmail}
            onChange={(e) => setEditorEmail(e.target.value)}
            style={{
              flex: '1 1 200px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--sidebar-border)',
              fontSize: '14px',
            }}
          />
          <button
            type="button"
            disabled={editorBusy || !editorEmail.trim()}
            onClick={() => void addEditor()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: editorBusy ? 'wait' : 'pointer',
              background: 'var(--sidebar-active-border)',
              color: '#fff',
            }}
          >
            {editorBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
            {editorBusy ? 'Adding…' : 'Add'}
          </button>
        </div>
        {editors.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {editors.map((ed) => (
              <li
                key={ed.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  padding: '8px 0',
                  borderTop: '0.5px solid var(--sidebar-border)',
                }}
              >
                <span>{ed.invited_email || ed.clerk_user_id}</span>
                <button
                  type="button"
                  disabled={editorBusy}
                  onClick={() => void removeEditor(ed.clerk_user_id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#b91c1c',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--sidebar-text)' }}>No extra editors yet.</p>
        )}
      </section>
    </div>
  )
}
