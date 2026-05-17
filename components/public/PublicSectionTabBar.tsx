'use client'

import { PRESET_PORTAL_ORIGINAL_ID, contrastTextForAccent, type ThemePreset } from '@/lib/leagueTheme'
import {
  PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA,
  PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE,
  PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE_TITLE,
} from '@/lib/public-plan-copy'
import { Lock } from 'lucide-react'
import {
  PublicSectionMobileMenu,
  usePublicSectionMobileLayout,
} from '@/components/public/PublicSectionMobileMenu'

type TabItem<T extends string> = { id: T; label: string; locked?: boolean }

export function PublicSectionTabBar<T extends string>({
  active,
  onChange,
  tabs,
  preset,
  maxWidth = '1000px',
  headingFontFamily,
  ariaLabel = 'Sections',
  /** When true (e.g. scroll sticky bar visible), mobile tab row hides its menu button. */
  mobileMenuInStickyBar = false,
}: {
  active: T
  onChange: (id: T) => void
  tabs: readonly TabItem<T>[]
  preset: ThemePreset
  maxWidth?: string
  headingFontFamily?: string
  ariaLabel?: string
  mobileMenuInStickyBar?: boolean
}) {
  const poster = preset.id === PRESET_PORTAL_ORIGINAL_ID
  const isMobile = usePublicSectionMobileLayout()
  const activeTab = tabs.find((t) => t.id === active)

  const navShell: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 45,
    background: poster ? preset.surfaceBg : preset.pageBg,
    backdropFilter: poster ? 'saturate(160%) blur(12px)' : undefined,
    WebkitBackdropFilter: poster ? 'saturate(160%) blur(12px)' : undefined,
    borderBottom: `1px solid ${preset.surfaceBorder}`,
    boxShadow: poster ? '0 2px 16px -8px rgba(0,0,0,0.08)' : '0 8px 24px -18px rgba(0,0,0,0.18)',
  }

  function renderTabLabel(t: TabItem<T>, isActive: boolean) {
    const tabLocked = !!t.locked
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
        {t.label}
        {tabLocked ? (
          <span
            title={PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE_TITLE}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              textTransform: 'none',
              color: poster && isActive ? 'rgba(255,255,255,0.92)' : preset.accent,
            }}
          >
            <Lock size={12} strokeWidth={2.5} aria-hidden />
            {PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE}
          </span>
        ) : null}
      </span>
    )
  }

  function desktopTabStyle(t: TabItem<T>, isActive: boolean) {
    const tabLocked = !!t.locked
    return {
      flex: '0 0 auto' as const,
      padding: poster ? '9px 18px' : '14px 14px',
      fontSize: '13px',
      fontWeight: poster ? 600 : 800,
      letterSpacing: poster ? '0.01em' : '0.02em',
      textTransform: 'none' as const,
      opacity: tabLocked && !isActive ? 0.88 : 1,
      ...(poster
        ? (() => {
            const c = isActive ? preset.accent : 'transparent'
            return {
              borderTopWidth: '1px',
              borderRightWidth: '1px',
              borderBottomWidth: '1px',
              borderLeftWidth: '1px',
              borderTopStyle: 'solid' as const,
              borderRightStyle: 'solid' as const,
              borderBottomStyle: 'solid' as const,
              borderLeftStyle: 'solid' as const,
              borderTopColor: c,
              borderRightColor: c,
              borderBottomColor: c,
              borderLeftColor: c,
            }
          })()
        : {
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: isActive ? `3px solid ${preset.accent}` : '3px solid transparent',
          }),
      borderRadius: poster ? '999px' : undefined,
      background: poster ? (isActive ? preset.accent : 'transparent') : 'transparent',
      color: poster
        ? isActive
          ? contrastTextForAccent(preset.accent)
          : preset.body
        : isActive
          ? preset.heading
          : preset.muted,
      cursor: 'pointer',
      fontFamily: poster && headingFontFamily ? headingFontFamily : 'inherit',
      boxShadow: poster && isActive ? '0 4px 14px -4px rgba(0,0,0,0.2)' : undefined,
    }
  }

  if (isMobile) {
    const showMenuHere = !mobileMenuInStickyBar
    return (
      <nav aria-label={ariaLabel} style={navShell}>
        <div
          style={{
            maxWidth,
            margin: '0 auto',
            padding: '10px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              justifyContent: showMenuHere ? 'flex-start' : 'center',
            }}
          >
            {showMenuHere ? (
              <PublicSectionMobileMenu
                active={active}
                onChange={onChange}
                tabs={tabs}
                preset={preset}
                headingFontFamily={headingFontFamily}
              />
            ) : null}
            <div style={{ flex: showMenuHere ? 1 : undefined, minWidth: 0, textAlign: showMenuHere ? 'left' : 'center' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: preset.muted,
                }}
              >
                Section
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '17px',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  color: preset.heading,
                  fontFamily: poster && headingFontFamily ? headingFontFamily : 'inherit',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeTab?.label ?? 'Menu'}
              </p>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label={ariaLabel} style={navShell}>
      <div
        style={{
          maxWidth,
          margin: '0 auto',
          padding: poster ? '12px 12px 14px' : '0 8px 2px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: poster ? '6px' : '2px',
            rowGap: poster ? '6px' : '0',
            background: poster ? preset.pageBg : undefined,
            padding: poster ? '5px' : undefined,
            borderRadius: poster ? '999px' : undefined,
            border: poster ? `1px solid ${preset.surfaceBorder}` : undefined,
          }}
        >
          {tabs.map((t) => {
            const isActive = active === t.id
            const tabLocked = !!t.locked
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tabLocked ? `${t.label} (${PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA})` : t.label}
                style={desktopTabStyle(t, isActive)}
              >
                {renderTabLabel(t, isActive)}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
