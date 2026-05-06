'use client'

import Link from 'next/link'

type PresetLike = { accent: string; heading: string; muted: string; body?: string }

export function LeagueNotFoundOrganizerHint({
  signedInOrg,
  currentSlug,
  preset,
  variant = 'default',
}: {
  signedInOrg: { slug: string; name: string } | null
  currentSlug: string
  preset: PresetLike
  variant?: 'default' | 'join' | 'register'
}) {
  if (!signedInOrg || signedInOrg.slug === currentSlug) return null

  const blurb =
    variant === 'register'
      ? 'The slug in this URL does not match your league. Use a registration link that includes your league slug, or open your league below.'
      : variant === 'join'
        ? 'The slug in this URL does not match your league. Use the join link from Dashboard → Settings, or open your league home below.'
        : 'The slug in this address does not match any league here. If you manage a league, your public URL uses the slug from Dashboard → Settings.'

  return (
    <div
      style={{
        marginTop: '22px',
        maxWidth: '400px',
        padding: '16px 18px',
        borderRadius: '14px',
        border: `1px solid ${preset.muted}33`,
        background: `${preset.accent}12`,
        textAlign: 'left',
      }}
    >
      <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: preset.heading }}>
        Signed in as organizer
      </p>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: preset.body ?? preset.muted, lineHeight: 1.55 }}>
        {blurb}
      </p>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: preset.heading, lineHeight: 1.5 }}>
        <strong>{signedInOrg.name}</strong> — slug <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{signedInOrg.slug}</strong>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', fontSize: '14px', fontWeight: 700 }}>
        <Link href={`/league/${signedInOrg.slug}`} style={{ color: preset.accent, textDecoration: 'underline' }}>
          League home
        </Link>
        <Link href={`/join/${signedInOrg.slug}`} style={{ color: preset.accent, textDecoration: 'underline' }}>
          Join hub
        </Link>
        <Link href="/dashboard/settings" style={{ color: preset.accent, textDecoration: 'underline' }}>
          Settings
        </Link>
      </div>
    </div>
  )
}
