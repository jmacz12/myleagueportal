'use client'

import { useEffect, useId, useState } from 'react'
import { Lock, Menu, X } from 'lucide-react'
import { PRESET_PORTAL_ORIGINAL_ID, type ThemePreset } from '@/lib/leagueTheme'
import {
  PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA,
  PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE,
  PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE_TITLE,
} from '@/lib/public-plan-copy'

export const PUBLIC_SECTION_MOBILE_MAX_WIDTH_PX = 767

type TabItem<T extends string> = { id: T; label: string; locked?: boolean }

export function usePublicSectionMobileLayout() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PUBLIC_SECTION_MOBILE_MAX_WIDTH_PX}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return isMobile
}

export function PublicSectionMobileMenu<T extends string>({
  active,
  onChange,
  tabs,
  preset,
  headingFontFamily,
  menuAlign = 'left',
  compact = false,
}: {
  active: T
  onChange: (id: T) => void
  tabs: readonly TabItem<T>[]
  preset: ThemePreset
  headingFontFamily?: string
  /** Panel anchors under the button edge on the sticky bar (right side). */
  menuAlign?: 'left' | 'right'
  compact?: boolean
}) {
  const menuId = useId()
  const poster = preset.id === PRESET_PORTAL_ORIGINAL_ID
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [active])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

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

  const btnSize = compact ? 40 : 44
  const iconSize = compact ? 18 : 20

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${btnSize}px`,
          height: `${btnSize}px`,
          borderRadius: '12px',
          border: `1px solid ${preset.surfaceBorder}`,
          background: preset.surfaceBg,
          color: preset.heading,
          cursor: 'pointer',
          boxShadow: '0 2px 10px -4px rgba(0,0,0,0.12)',
        }}
      >
        {menuOpen ? <X size={iconSize} strokeWidth={2.25} aria-hidden /> : <Menu size={iconSize} strokeWidth={2.25} aria-hidden />}
        <span className="sr-only">{menuOpen ? 'Close sections menu' : 'Open sections menu'}</span>
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close sections menu"
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              border: 'none',
              padding: 0,
              margin: 0,
              background: 'rgba(15, 23, 42, 0.35)',
              cursor: 'default',
            }}
          />
          <div
            id={menuId}
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              ...(menuAlign === 'right' ? { right: 0 } : { left: 0 }),
              minWidth: 'min(280px, calc(100vw - 28px))',
              background: preset.surfaceBg,
              border: `1px solid ${preset.surfaceBorder}`,
              borderRadius: '16px',
              padding: '8px',
              boxShadow: '0 16px 40px -12px rgba(0,0,0,0.22)',
              zIndex: 60,
            }}
          >
          {tabs.map((t) => {
            const isActive = active === t.id
            const tabLocked = !!t.locked
            return (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                onClick={() => onChange(t.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tabLocked ? `${t.label} (${PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA})` : t.label}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '14px 16px',
                  border: 'none',
                  borderRadius: '12px',
                  background: isActive ? preset.accentSoftBg : 'transparent',
                  color: preset.heading,
                  fontSize: '15px',
                  fontWeight: isActive ? 800 : 600,
                  fontFamily: poster && headingFontFamily ? headingFontFamily : 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {renderTabLabel(t, isActive)}
              </button>
            )
          })}
          </div>
        </>
      ) : null}
    </div>
  )
}
