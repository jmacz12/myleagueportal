'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import type { ThemePreset } from '@/lib/leagueTheme'
import { contrastTextForAccent } from '@/lib/leagueTheme'

type LeaguePublicAuthBarProps = {
  preset: ThemePreset
  canManageSite: boolean
  accessResolved: boolean
}

export function LeaguePublicAuthBar({ preset, canManageSite, accessResolved }: LeaguePublicAuthBarProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const returnPath = (() => {
    const q = searchParams.toString()
    return q ? `${pathname}?${q}` : pathname
  })()

  if (!isLoaded || !accessResolved) return null

  const showSignIn = !isSignedIn
  const showDashboard = !!isSignedIn && canManageSite

  if (!showSignIn && !showDashboard) return null

  return (
    <div
      style={{
        borderBottom: `1px solid ${preset.surfaceBorder}`,
        background: preset.surfaceBg,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          minHeight: '44px',
        }}
      >
        {showSignIn ? (
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px 18px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 800,
              textDecoration: 'none',
              border: `1px solid ${preset.surfaceBorder}`,
              background: preset.pageBg,
              color: preset.heading,
            }}
          >
            Sign in
          </Link>
        ) : null}

        {showDashboard ? (
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px 18px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 800,
              textDecoration: 'none',
              background: preset.accent,
              color: contrastTextForAccent(preset.accent),
              boxShadow: '0 4px 14px -6px rgba(0,0,0,0.25)',
            }}
          >
            Go to dashboard
          </Link>
        ) : null}
      </div>
    </div>
  )
}
