import Link from 'next/link'
import { Lock } from 'lucide-react'

type Props = {
  title: string
  body: React.ReactNode
}

export function DashboardPlanLockedCard({ title, body }: Props) {
  return (
    <div
      className="card"
      style={{
        padding: '28px 24px',
        textAlign: 'center',
        border: '0.5px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: 'var(--text-muted)',
        }}
      >
        <Lock size={24} aria-hidden />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
        {title}
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: '420px', margin: '0 auto 20px' }}>
        {body}
      </p>
      <Link href="/dashboard/settings?tab=plan" className="btn-primary" style={{ textDecoration: 'none' }}>
        Compare plans
      </Link>
    </div>
  )
}
