'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

type LandingSignedInChromeProps = {
  leagueSlug: string | null
}

const linkStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#1a1a0a',
  textDecoration: 'none',
}

const pillSecondary: CSSProperties = {
  background: 'white',
  color: '#1a1a0a',
  border: '0.5px solid #d4c9a8',
  borderRadius: '9px',
  padding: '13px 22px',
  fontSize: '14px',
  fontWeight: '700',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
}

const pillPrimary: CSSProperties = {
  background: '#1a1a0a',
  color: '#d4c97a',
  borderRadius: '9px',
  padding: '13px 22px',
  fontSize: '14px',
  fontWeight: '700',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
}

export function LandingSignedInNav({ leagueSlug }: LandingSignedInChromeProps) {
  return (
    <>
      <Link href="/dashboard" style={linkStyle}>
        Dashboard
      </Link>
      {leagueSlug ? (
        <>
          <Link href={`/league/${encodeURIComponent(leagueSlug)}`} style={linkStyle}>
            League home
          </Link>
          <Link href="/dashboard/teams" style={linkStyle}>
            Teams
          </Link>
        </>
      ) : (
        <Link href="/onboarding" style={linkStyle}>
          Finish setup
        </Link>
      )}
      <UserButton />
    </>
  )
}

export function LandingSignedInHeroActions({ leagueSlug }: LandingSignedInChromeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '420px', margin: '0 auto' }}>
      <p style={{ fontSize: '13px', color: 'rgba(242,234,214,0.75)', margin: 0, lineHeight: 1.5 }}>
        You&apos;re signed in — open the dashboard, your public league page, or team tools.
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={pillPrimary}>
          Go to dashboard
        </Link>
        {leagueSlug ? (
          <Link href={`/league/${encodeURIComponent(leagueSlug)}`} style={pillSecondary}>
            View league home
          </Link>
        ) : null}
        {leagueSlug ? (
          <Link href="/dashboard/teams" style={pillSecondary}>
            Manage teams
          </Link>
        ) : (
          <Link href="/onboarding" style={pillSecondary}>
            Finish league setup
          </Link>
        )}
      </div>
    </div>
  )
}
