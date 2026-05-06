'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  type LucideIcon,
  LayoutDashboard,
  CalendarDays,
  Users,
  UserCircle,
  Trophy,
  Timer,
  Settings,
  Globe,
} from 'lucide-react'

const allNavItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/dashboard/seasons', label: 'Seasons', Icon: CalendarDays },
  { href: '/dashboard/teams', label: 'Teams', Icon: Users },
  { href: '/dashboard/players', label: 'Players', Icon: UserCircle },
  { href: '/dashboard/games', label: 'Games', Icon: Trophy },
  { href: '/dashboard/dropin', label: 'Drop-ins', Icon: Timer },
  { href: '/dashboard/league-site', label: 'League website', Icon: Globe },
  { href: '/dashboard/settings', label: 'Settings', Icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [access, setAccess] = useState<{ role: 'owner' | 'editor' } | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/org-access')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setAccess(d.access ?? null)
      })
      .catch(() => {
        if (!cancelled) setAccess(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!access || access.role !== 'editor') return
    const onLeagueSite =
      pathname === '/dashboard/league-site' || pathname.startsWith('/dashboard/league-site/')
    if (!onLeagueSite) router.replace('/dashboard/league-site')
  }, [access, pathname, router])

  const navItems = useMemo(() => {
    if (access?.role === 'editor') {
      return allNavItems.filter((i) => i.href === '/dashboard/league-site')
    }
    return allNavItems
  }, [access])

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
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: 'var(--btn-primary-text)',
                letterSpacing: '0.06em',
              }}>ML</span>
            </div>
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
          {(access === undefined ? allNavItems : navItems).map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: isActive(href) ? '700' : '400',
                color: isActive(href)
                  ? 'var(--sidebar-text-active)'
                  : 'var(--sidebar-text)',
                background: isActive(href)
                  ? 'var(--sidebar-active-bg)'
                  : 'transparent',
                borderLeft: isActive(href)
                  ? '2px solid var(--sidebar-active-border)'
                  : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} strokeWidth={2} style={{ opacity: 0.85, flexShrink: 0 }} />
              {label}
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
        {(access === undefined ? allNavItems : navItems).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '8px 4px',
              textDecoration: 'none',
              color: isActive(href)
                ? 'var(--sidebar-active-border)'
                : 'var(--sidebar-text)',
              fontSize: '10px',
              fontWeight: isActive(href) ? '700' : '400',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={18} strokeWidth={2} style={{ opacity: 0.9 }} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}