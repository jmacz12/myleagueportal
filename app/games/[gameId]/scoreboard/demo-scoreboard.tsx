import { Trophy } from 'lucide-react'

/** Static preview for `/games/demo/scoreboard` — no database. */
export function DemoPublicScoreboard() {
  const homeRows = [
    { j: 7, name: 'Jordan P.', pts: 24, fg2m: 6, fg3m: 2, ftm: 6, ast: 5, reb: 4, stl: 1, blk: 0, tov: 2, pf: 1 },
    { j: 23, name: 'Alex R.', pts: 14, fg2m: 4, fg3m: 1, ftm: 3, ast: 2, reb: 8, stl: 0, blk: 1, tov: 1, pf: 2 },
    { j: 11, name: 'Sam K.', pts: 9, fg2m: 2, fg3m: 1, ftm: 2, ast: 6, reb: 2, stl: 2, blk: 0, tov: 3, pf: 0 },
  ]
  const awayRows = [
    { j: 3, name: 'Chris L.', pts: 21, fg2m: 5, fg3m: 3, ftm: 2, ast: 3, reb: 5, stl: 2, blk: 0, tov: 2, pf: 3 },
    { j: 15, name: 'Taylor M.', pts: 16, fg2m: 5, fg3m: 2, ftm: 0, ast: 1, reb: 6, stl: 1, blk: 2, tov: 1, pf: 2 },
    { j: 44, name: 'Jamie D.', pts: 11, fg2m: 4, fg3m: 1, ftm: 0, ast: 4, reb: 3, stl: 0, blk: 0, tov: 0, pf: 1 },
  ]
  const statHeaders = ['#', 'Player', 'PTS', '2PM', '3PM', 'FTM', 'AST', 'REB', 'STL', 'BLK', 'TOV', 'PF']

  function MiniTable({
    title,
    color,
    rows,
  }: {
    title: string
    color: string
    rows: typeof homeRows
  }) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: color }} />
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a0a' }}>{title}</div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#9a8c6a', marginLeft: '6px' }}>DEMO</span>
        </div>
        <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '0.5px solid #d4c9a8', overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px minmax(100px, 1fr) repeat(10, minmax(36px, 40px))',
              gap: '4px',
              padding: '8px 14px',
              background: '#ede5cc',
              minWidth: '520px',
            }}
          >
            {statHeaders.map((h) => (
              <span
                key={h}
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#9a8c6a',
                  textAlign: h !== 'Player' ? 'center' : 'left',
                }}
              >
                {h}
              </span>
            ))}
          </div>
          {rows.map((s, idx) => (
            <div
              key={s.j}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(100px, 1fr) repeat(10, minmax(36px, 40px))',
                gap: '4px',
                padding: '10px 14px',
                borderTop: idx > 0 ? '0.5px solid #f0e8d0' : 'none',
                alignItems: 'center',
                minWidth: '520px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#9a8c6a', textAlign: 'center' }}>#{s.j}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a0a' }}>{s.name}</span>
              {[s.pts, s.fg2m, s.fg3m, s.ftm, s.ast, s.reb, s.stl, s.blk, s.tov, s.pf].map((v, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '13px',
                    fontWeight: i === 0 ? '800' : '400',
                    color: i === 0 ? '#1a1a0a' : '#6b5e3a',
                    textAlign: 'center',
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6' }}>
      <div style={{ background: '#1a1a0a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#d4c97a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            MyLeaguePortal · Demo scoreboard (sample data)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#5a7a2a', display: 'inline-block', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>North Hoopers</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <div
                  style={{
                    background: '#d4c97a',
                    color: '#1a1a0a',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontSize: '40px',
                    fontWeight: '800',
                    fontFamily: 'monospace',
                    minWidth: '80px',
                    textAlign: 'center',
                  }}
                >
                  62
                </div>
                <span style={{ color: '#9a8c6a', fontSize: '20px' }}>—</span>
                <div
                  style={{
                    background: '#d4c97a',
                    color: '#1a1a0a',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontSize: '40px',
                    fontWeight: '800',
                    fontFamily: 'monospace',
                    minWidth: '80px',
                    textAlign: 'center',
                  }}
                >
                  58
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                <span style={{ background: '#dc2626', color: 'white', borderRadius: '99px', fontSize: '10px', fontWeight: '700', padding: '2px 8px' }}>
                  Live
                </span>
                <span style={{ color: '#9a8c6a', fontSize: '12px' }}>Q3 · 4:12</span>
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#4c6fa8', display: 'inline-block', marginBottom: '4px' }} />
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>South Runners</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px' }}>
        <MiniTable title="North Hoopers" color="#5a7a2a" rows={homeRows} />
        <MiniTable title="South Runners" color="#4c6fa8" rows={awayRows} />

        <div style={{ marginTop: '24px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#9a8c6a',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trophy size={14} strokeWidth={2} aria-hidden />
            Game highlights (demo)
          </div>
          <div style={{ background: '#1a1a0a', border: '1.5px solid #d4c97a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#d4c97a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Player of the Game (sample)
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>Jordan P.</div>
            <div style={{ fontSize: '11px', color: '#9a8c6a', marginTop: '4px' }}>North Hoopers · 24 PTS</div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: '#9a8c6a', lineHeight: 1.5 }}>
          This page uses fake names and numbers. Real games use your league&apos;s URL:{' '}
          <code style={{ fontWeight: 700, color: '#6b5e3a' }}>/games/&lt;game-id&gt;/scoreboard</code>
        </p>
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <span style={{ fontSize: '11px', color: '#c8b98a' }}>
            Powered by <span style={{ fontWeight: '700', color: '#9a8c6a' }}>MyLeaguePortal</span>
          </span>
        </div>
      </div>
    </div>
  )
}
