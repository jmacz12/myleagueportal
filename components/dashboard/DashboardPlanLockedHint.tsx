import Link from 'next/link'
import { Lock } from 'lucide-react'

type Props = {
  /** Short feature name, e.g. "Fan email alerts" */
  feature: string
  /** Defaults to Pro or Enterprise */
  tierLabel?: string
}

export function DashboardPlanLockedHint({ feature, tierLabel = 'Pro or Enterprise' }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 12px',
        marginBottom: '14px',
        borderRadius: '8px',
        border: '0.5px solid var(--border)',
        background: 'var(--bg-elevated)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        lineHeight: 1.45,
      }}
    >
      <Lock size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden />
      <span>
        <strong style={{ color: 'var(--text-primary)' }}>{tierLabel}</strong> — {feature}.{' '}
        <Link href="/dashboard/settings?tab=plan" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          Compare plans
        </Link>
      </span>
    </div>
  )
}
