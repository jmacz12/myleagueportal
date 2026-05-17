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
  BarChart3,
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
  { href: '/dashboard/stats', label: 'Stats', Icon: BarChart3 },
  { href: '/dashboard/dropin', label: 'Drop-ins', Icon: Timer },
  { href: '/dashboard/league-site', label: 'League website', Icon: Globe },
  { href: '/dashboard/settings', label: 'Settings', Icon: Settings },
]

type DashboardOrgAccess =
  | {
      role: 'owner' | 'editor'
      name: string
      slug: string
      logoUrl: string | null
    }
  | null
  | undefined

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [access, setAccess] = useState<DashboardOrgAccess>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/org-access')
      .then((r) => r.json())
      .then((d: { access?: { role: string; name?: string; slug?: string; logoUrl?: string | null } }) => {
        if (cancelled) return
        const a = d.access
        if (!a || (a.role !== 'owner' && a.role !== 'editor')) {
          setAccess(null)
          return
        }
        const name = typeof a.name === 'string' ? a.name.trim() : ''
        const slug = typeof a.slug === 'string' ? a.slug.trim() : ''
        if (!name || !slug) {
          setAccess(null)
          return
        }
        setAccess({
          role: a.role,
          name,
          slug,
          logoUrl: typeof a.logoUrl === 'string' && a.logoUrl.trim() ? a.logoUrl.trim() : null,
        })
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

  const showWelcomeStrip =
    Boolean(access?.name) && pathname !== '/dashboard' && pathname.startsWith('/dashboard')

  const sidebarLoaded = access !== undefined
  const leagueLogoUrl = access?.logoUrl ?? null

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

        {/* League + product mark */}
        <div style={{
          padding: '20px 16px 18px',
          borderBottom: '0.5px solid var(--sidebar-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'var(--logo-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '0.5px solid var(--sidebar-border)',
            }}>
              {sidebarLoaded && leagueLogoUrl ? (
                <img
                  src={leagueLogoUrl}
                  alt=""
                  width={36}
                  height={36}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'var(--btn-primary-text)',
                  letterSpacing: '0.06em',
                }}>ML</span>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '800',
                color: 'var(--sidebar-text-active)',
                letterSpacing: '0.01em',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {sidebarLoaded && access ? access.name : 'MyLeaguePortal'}
              </div>
              <div style={{
                fontSize: '9px',
                color: 'var(--sidebar-text)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginTop: '4px',
              }}>
                {sidebarLoaded && access ? 'League dashboard' : 'League Management'}
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
          backgroundColor: 'var(--bg-base)',
          backgroundImage:
            'radial-gradient(ellipse 120% 55% at 50% -12%, color-mix(in srgb, var(--accent-muted) 55%, transparent), transparent 72%)',
          minHeight: '100vh',
        }}
      >
        {showWelcomeStrip && access ? (
          <p style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
          }}>
            Welcome back — you&apos;re managing{' '}
            <strong style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{access.name}</strong>
          </p>
        ) : null}
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
