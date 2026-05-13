'use client'

import type { ReactNode } from 'react'
import { PRESET_PORTAL_ORIGINAL_ID, type PublicHeroTheme, type ThemePreset } from '@/lib/leagueTheme'

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
  usePlatformBranding,
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
  /** Basic plan: show house lockup instead of league-uploaded logo */
  usePlatformBranding?: boolean
}) {
  const heroBg = heroBackgroundUrl
  const poster = preset.id === PRESET_PORTAL_ORIGINAL_ID && !compact
  const padY = compact ? '38px' : poster ? '48px' : '54px'
  const padB = compact ? '40px' : poster ? '52px' : '56px'
  const logoH = compact ? 64 : poster ? 80 : 76
  const box = compact ? 64 : poster ? 80 : 76
  const displaySerif =
    'Georgia, "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif'

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: poster ? `3px solid ${preset.accent}` : `4px solid ${preset.accent}`,
        padding: `${padY} clamp(20px, 4vw, 36px) ${padB}`,
        textAlign: poster ? 'left' : 'center',
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
      <div
        style={{
          position: 'relative',
          maxWidth: poster ? 'min(1120px, 100%)' : undefined,
          margin: poster ? '0 auto' : undefined,
        }}
      >
        {usePlatformBranding ? (
          <div
            style={{
              margin: poster ? '0 0 18px' : '0 auto 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: poster ? 'flex-start' : 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: heroTheme.heroSubtitle,
              }}
            >
              Hosted on
            </span>
            <div
              style={{
                fontSize: compact ? '15px' : '17px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: heroTheme.heroTitle,
                padding: '10px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(0,0,0,0.25)',
              }}
            >
              MyLeaguePortal
            </div>
          </div>
        ) : logoUrl ? (
          <img
            src={logoUrl}
            alt={orgName}
            style={{
              height: `${logoH}px`,
              width: 'auto',
              objectFit: 'contain',
              margin: poster ? '0 0 16px' : '0 auto 18px',
              display: 'block',
              borderRadius: poster ? '14px' : '10px',
              border: poster ? `1px solid rgba(255,255,255,0.22)` : undefined,
              boxShadow: poster ? '0 12px 40px rgba(0,0,0,0.35)' : undefined,
            }}
          />
        ) : (
          <div
            style={{
              width: `${box}px`,
              height: `${box}px`,
              borderRadius: poster ? '14px' : '14px',
              margin: poster ? '0 0 16px' : '0 auto 18px',
              background: heroTheme.heroPlaceholderBg,
              border: poster ? `1px solid rgba(255,255,255,0.22)` : `2px solid ${heroTheme.heroPlaceholderBorder}`,
              color: heroTheme.heroPlaceholderColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? '24px' : poster ? '30px' : '28px',
              fontWeight: 900,
              boxShadow: poster ? '0 12px 40px rgba(0,0,0,0.35)' : undefined,
            }}
            aria-hidden
          >
            {placeholderInitials}
          </div>
        )}
        <h1
          style={{
            fontFamily: poster ? displaySerif : undefined,
            fontSize: compact ? 'clamp(24px, 5vw, 34px)' : poster ? 'clamp(32px, 6.5vw, 48px)' : 'clamp(30px, 6vw, 42px)',
            fontWeight: poster ? 800 : 900,
            letterSpacing: poster ? '-0.02em' : '-0.02em',
            margin: '0 0 8px',
            color: heroTheme.heroTitle,
            maxWidth: poster ? '18ch' : undefined,
            lineHeight: poster ? 1.08 : undefined,
          }}
        >
          {orgName}
        </h1>
        <p
          style={{
            color: heroTheme.heroSubtitle,
            margin: 0,
            fontSize: compact ? 'clamp(13px, 2vw, 15px)' : poster ? 'clamp(14px, 2vw, 17px)' : 'clamp(14px, 2vw, 16px)',
            maxWidth: poster ? '42rem' : '560px',
            marginLeft: poster ? 0 : 'auto',
            marginRight: poster ? 0 : 'auto',
            lineHeight: 1.55,
            fontWeight: poster ? 600 : undefined,
          }}
        >
          {tagline}
        </p>
        {showStats ? (
          <div
            style={{
              display: 'flex',
              justifyContent: poster ? 'flex-start' : 'center',
              gap: poster ? '12px' : '10px',
              flexWrap: 'wrap',
              marginTop: poster ? '26px' : '22px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: heroTheme.heroTitle,
                padding: poster ? '11px 17px' : '10px 16px',
                borderRadius: '999px',
                border: poster ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.28)',
                background: poster ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.22)',
                backdropFilter: poster ? 'blur(8px)' : undefined,
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
                padding: poster ? '11px 17px' : '10px 16px',
                borderRadius: '999px',
                border: poster ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.28)',
                background: poster ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.22)',
                backdropFilter: poster ? 'blur(8px)' : undefined,
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
                  padding: poster ? '11px 17px' : '10px 16px',
                  borderRadius: '999px',
                  border: poster ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.28)',
                  background: poster ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.22)',
                  backdropFilter: poster ? 'blur(8px)' : undefined,
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
