'use client'

/** One row per roster player for an open poll; `preferred_number` null = not picked yet. */
export type JerseyPollRosterRow = {
  player_id: string
  full_name: string
  preferred_number: number | null
}

type Shell = { text: string; muted: string; border: string; surface: string }

export function JerseyPollResponsesTable({
  rows,
  variant,
  shell,
}: {
  rows: JerseyPollRosterRow[]
  variant: 'dashboard' | 'managePanel'
  shell?: Shell
}) {
  if (rows.length === 0) {
    const empty =
      variant === 'dashboard'
        ? 'No players on this team yet.'
        : 'No players on this team yet.'
    return (
      <p style={{ fontSize: '12px', color: variant === 'dashboard' ? 'var(--text-muted)' : shell?.muted ?? '#64748b', margin: 0 }}>
        {empty}
      </p>
    )
  }

  const picked = rows.filter((r) => r.preferred_number != null).length

  const caption =
    variant === 'dashboard' ? (
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
        {picked} of {rows.length} picked a number · first save wins on each number
      </p>
    ) : (
      <p style={{ fontSize: '11px', color: shell?.muted ?? '#64748b', margin: '0 0 8px', lineHeight: 1.4 }}>
        {picked} of {rows.length} picked · first save wins
      </p>
    )

  if (variant === 'dashboard') {
    return (
      <div>
        {caption}
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '0.5px solid var(--border-light)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Player</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '72px' }}>#</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player_id} style={{ borderTop: '0.5px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.full_name}</td>
                  <td
                    style={{
                      padding: '8px 10px',
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: r.preferred_number == null ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}
                  >
                    {r.preferred_number == null ? '—' : r.preferred_number}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const s = shell ?? { text: '#0f172a', muted: '#64748b', border: '1px solid rgba(15,23,42,0.12)', surface: 'rgba(15,23,42,0.04)' }

  return (
    <div>
      {caption}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: s.border, marginTop: '2px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: s.text }}>
          <thead>
            <tr style={{ background: s.surface, textAlign: 'left', color: s.muted }}>
              <th style={{ padding: '8px 10px', fontWeight: 700 }}>Player</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '64px' }}>#</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_id} style={{ borderTop: `0.5px solid ${s.border}` }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.full_name}</td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                    color: r.preferred_number == null ? s.muted : s.text,
                  }}
                >
                  {r.preferred_number == null ? '—' : r.preferred_number}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
