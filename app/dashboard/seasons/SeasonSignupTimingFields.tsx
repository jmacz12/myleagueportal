'use client'

/** Same choices as Drop-ins: when public season signup opens on the join page. */

const OPTIONS = [
  { value: 'open_now', title: 'Open now', sub: 'People can register right away' },
  { value: 'closed', title: 'Keep closed', sub: 'Registration stays off until you open it' },
  { value: 'scheduled', title: 'Schedule opening', sub: 'Opens a set number of days before season starts' },
  { value: 'custom', title: 'Custom date & time', sub: 'Opens at a date and time you choose' },
] as const

type Props = {
  signupOption: string
  setSignupOption: (v: string) => void
  signupDaysBefore: string
  setSignupDaysBefore: (v: string) => void
  customOpensAt: string
  setCustomOpensAt: (v: string) => void
  closesAt: string
  setClosesAt: (v: string) => void
  /** For scheduled mode hint when season start is missing */
  seasonStartDate?: string
}

export default function SeasonSignupTimingFields({
  signupOption,
  setSignupOption,
  signupDaysBefore,
  setSignupDaysBefore,
  customOpensAt,
  setCustomOpensAt,
  closesAt,
  setClosesAt,
  seasonStartDate,
}: Props) {
  return (
    <div>
      <label className="label" style={{ marginBottom: '8px' }}>
        When can people register?
      </label>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
        This is only the public sign-up window. Season dates below are separate.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSignupOption(opt.value)}
            style={{
              padding: '10px 8px',
              borderRadius: '8px',
              border:
                signupOption === opt.value ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
              background: signupOption === opt.value ? 'var(--accent-muted)' : 'var(--bg-surface)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>{opt.title}</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{opt.sub}</div>
          </button>
        ))}
      </div>
      {signupOption === 'scheduled' && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginTop: '8px',
          }}
        >
          {!seasonStartDate && (
            <p style={{ fontSize: '11px', color: '#b45309', margin: '0 0 8px', lineHeight: 1.45 }}>
              Add a <strong>season start date</strong> above so “days before” has a reference date.
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="number"
              value={signupDaysBefore}
              min={1}
              max={365}
              onChange={(e) => setSignupDaysBefore(e.target.value)}
              style={{
                width: '60px',
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border)',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '12px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              calendar days before <strong>season start</strong>
            </span>
          </div>
        </div>
      )}
      {signupOption === 'custom' && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginTop: '8px',
          }}
        >
          <label className="label" style={{ fontSize: '11px' }}>
            Signups open at
          </label>
          <input
            type="datetime-local"
            className="input"
            value={customOpensAt}
            onChange={(e) => setCustomOpensAt(e.target.value)}
            style={{ fontSize: '13px', marginTop: '6px' }}
          />
        </div>
      )}
      {signupOption === 'closed' && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          Players won&apos;t see season signup on your join link until you switch away from Keep closed.
        </div>
      )}

      <div style={{ marginTop: '14px' }}>
        <label className="label" style={{ fontSize: '11px' }}>
          Signups close (optional)
        </label>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 6px', lineHeight: 1.45 }}>
          Leave blank for no deadline — registration stays open until you close it or the season ends.
        </p>
        <input
          type="datetime-local"
          className="input"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          style={{ fontSize: '13px' }}
        />
      </div>
    </div>
  )
}
