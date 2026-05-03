'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '▣' },
  { href: '/dashboard/seasons', label: 'Seasons', icon: '◷' },
  { href: '/dashboard/teams', label: 'Teams', icon: '◈' },
  { href: '/dashboard/players', label: 'Players', icon: '◉' },
  { href: '/dashboard/games', label: 'Games', icon: '🎮' },
  { href: '/dashboard/dropin', label: 'Drop-ins', icon: '🎲' },
  { href: '/dashboard/settings', label: 'Settings', icon: '◎' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar" style={{
        width: '220px',
        background: 'var(--sidebar-bg)',
        borderRight: `0.5px solid var(--sidebar-border)`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 16px 18px',
          borderBottom: '0.5px solid var(--sidebar-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'var(--logo-bg)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              flexShrink: 0,
            }}>⚡</div>
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: '800',
                color: 'var(--sidebar-text-active)',
                letterSpacing: '0.02em',
              }}>
                MyLeaguePortal
              </div>
              <div style={{
                fontSize: '9px',
                color: 'var(--sidebar-text)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                League Management
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: isActive(item.href) ? '700' : '400',
                color: isActive(item.href)
                  ? 'var(--sidebar-text-active)'
                  : 'var(--sidebar-text)',
                background: isActive(item.href)
                  ? 'var(--sidebar-active-bg)'
                  : 'transparent',
                borderLeft: isActive(item.href)
                  ? '2px solid var(--sidebar-active-border)'
                  : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '13px', opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: '14px 16px',
          borderTop: '0.5px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <UserButton />
          <span style={{ fontSize: '12px', color: 'var(--sidebar-text)' }}>
            My Account
          </span>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="dashboard-main"
        style={{
          flex: 1,
          marginLeft: '220px',
          padding: '32px 36px',
          background: 'var(--bg-base)',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '8px 4px',
              textDecoration: 'none',
              color: isActive(item.href)
                ? 'var(--sidebar-active-border)'
                : 'var(--sidebar-text)',
              fontSize: '10px',
              fontWeight: isActive(item.href) ? '700' : '400',
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}