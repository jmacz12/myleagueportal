'use client'

import type { ReactNode } from 'react'
import type { PublicHeroTheme, ThemePreset } from '@/lib/leagueTheme'

/**
 * Shared league header: gradient (or photo) hero with logo, org name, tagline, optional stat pills.
 * Used on `/league/[slug]` and join flows for visual consistency.
 */
export function PublicLeagueHeroBand({
  orgName,
  logoUrl,
  heroBackgroundUrl,
  tagline,
  placeholderInitials,
  preset,
  heroTheme,
  compact,
  showStats,
  teamsCount,
  playersCount,
  showSeasonPill,
  bottomSlot,
}: {
  orgName: string
  logoUrl: string | null
  heroBackgroundUrl: string | null
  tagline: string
  placeholderInitials: string
  preset: ThemePreset
  heroTheme: PublicHeroTheme
  /** Tighter padding + slightly smaller logo on join/register/drop-ins */
  compact?: boolean
  showStats?: boolean
  teamsCount?: number
  playersCount?: number
  showSeasonPill?: boolean
  bottomSlot?: ReactNode
}) {
  const heroBg = heroBackgroundUrl
  const padY = compact ? '38px' : '54px'
  const padB = compact ? '40px' : '56px'
  const logoH = compact ? 64 : 76
  const box = compact ? 64 : 76

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: `4px solid ${preset.accent}`,
        padding: `${padY} 24px ${padB}`,
        textAlign: 'center',
        color: heroTheme.heroTitle,
      }}
    >
      {heroBg ? (
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
          aria-hidden
        />
      ) : null}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: heroTheme.heroGradient,
          opacity: heroBg ? 0.9 : 1,
        }}
        aria-hidden
      />
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: heroTheme.heroGlow,
        }}
        aria-hidden
      />
      <div style={{ position: 'relative' }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={orgName}
            style={{
              height: `${logoH}px`,
              width: 'auto',
              objectFit: 'contain',
              margin: '0 auto 18px',
              display: 'block',
              borderRadius: '10px',
            }}
          />
        ) : (
          <div
            style={{
              width: `${box}px`,
              height: `${box}px`,
              borderRadius: '14px',
              margin: '0 auto 18px',
              background: heroTheme.heroPlaceholderBg,
              border: `2px solid ${heroTheme.heroPlaceholderBorder}`,
              color: heroTheme.heroPlaceholderColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? '24px' : '28px',
              fontWeight: 900,
            }}
            aria-hidden
          >
            {placeholderInitials}
          </div>
        )}
        <h1
          style={{
            fontSize: compact ? 'clamp(24px, 5vw, 34px)' : 'clamp(30px, 6vw, 42px)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            color: heroTheme.heroTitle,
          }}
        >
          {orgName}
        </h1>
        <p
          style={{
            color: heroTheme.heroSubtitle,
            margin: 0,
            fontSize: compact ? 'clamp(13px, 2vw, 15px)' : 'clamp(14px, 2vw, 16px)',
            maxWidth: '560px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.55,
          }}
        >
          {tagline}
        </p>
        {showStats ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '22px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: heroTheme.heroTitle,
                padding: '10px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(0,0,0,0.22)',
              }}
            >
              {teamsCount ?? 0} teams
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: heroTheme.heroTitle,
                padding: '10px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(0,0,0,0.22)',
              }}
            >
              {playersCount ?? 0} players
            </span>
            {showSeasonPill ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: heroTheme.heroTitle,
                  padding: '10px 16px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: 'rgba(0,0,0,0.22)',
                }}
              >
                Active season
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {bottomSlot}
    </div>
  )
}
