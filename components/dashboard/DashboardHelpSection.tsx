import type { ReactNode } from 'react'

export function DashboardHelpSection({
  title,
  badge,
  children,
}: {
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <section style={{ marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h3>
        {badge ? (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '99px',
              background: 'var(--accent-muted)',
              color: 'var(--accent-text, var(--accent))',
              border: '0.5px solid var(--accent)',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}
