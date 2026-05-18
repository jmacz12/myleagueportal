'use client'

import { BookOpen } from 'lucide-react'

type DashboardHowItWorksButtonProps = {
  onClick: () => void
  label?: string
}

export function DashboardHowItWorksButton({
  onClick,
  label = 'How it works',
}: DashboardHowItWorksButtonProps) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      <BookOpen size={16} aria-hidden />
      {label}
    </button>
  )
}
