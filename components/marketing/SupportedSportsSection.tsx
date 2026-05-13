import { SPORT_TEMPLATES } from '@/lib/sport-templates'

/**
 * Marketing home (`/`) — supported sports and default registration positions.
 */
export function SupportedSportsSection() {
  return (
    <section
      style={{
        background: '#f8f5ec',
        borderTop: '0.5px solid #d4c9a8',
        borderBottom: '0.5px solid #d4c9a8',
        padding: '56px 24px 64px',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2
            style={{
              fontSize: 'clamp(22px, 3vw, 32px)',
              fontWeight: 800,
              color: '#1a1a0a',
              marginBottom: '10px',
              letterSpacing: '-0.01em',
            }}
          >
            Sports &amp; positions
          </h2>
          <p style={{ fontSize: '15px', color: '#6b5e3a', maxWidth: '560px', margin: '0 auto', lineHeight: 1.55 }}>
            When you create a league, you pick a sport so season sign-up shows the right position chips. Here&apos;s what
            MyLeaguePortal is built for today — more templates can ship as we grow.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '14px',
          }}
        >
          {SPORT_TEMPLATES.map((sport) => (
            <div
              key={sport.id}
              style={{
                background: 'white',
                border: '0.5px solid #d4c9a8',
                borderRadius: '12px',
                padding: '18px 18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a0a', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                  {sport.name}
                </h3>
                <p style={{ fontSize: '12px', color: '#6b5e3a', lineHeight: 1.5, margin: 0 }}>{sport.blurb}</p>
              </div>
              {sport.positions.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {sport.positions.map((p) => (
                    <span
                      key={p}
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: '#3a5a10',
                        background: 'rgba(138, 170, 74, 0.18)',
                        border: '0.5px solid rgba(90, 122, 42, 0.35)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9a8c6a', margin: 0, fontStyle: 'italic' }}>
                  No fixed position list — great for social leagues.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
