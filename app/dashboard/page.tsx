import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function DashboardPage() {
  const { userId } = await auth()

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('clerk_user_id', userId!)
    .single()

  const { count: playerCount } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org?.id)

  const { count: teamCount } = await supabaseAdmin
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org?.id)

  const { count: seasonCount } = await supabaseAdmin
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org?.id)

  let nextGameStrip: { href: string; title: string; when: string } | null = null
  if (org?.id) {
    const { data: nextGame } = await supabaseAdmin
      .from('games')
      .select('id, scheduled_at, status, home_team_id, away_team_id')
      .eq('organization_id', org.id)
      .not('scheduled_at', 'is', null)
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextGame?.scheduled_at) {
      const ids = [nextGame.home_team_id, nextGame.away_team_id].filter(Boolean) as string[]
      const nameBy = new Map<string, string>()
      if (ids.length) {
        const { data: teamRows } = await supabaseAdmin.from('teams').select('id,name').in('id', ids)
        for (const row of teamRows ?? []) {
          if (row.id && typeof row.name === 'string') nameBy.set(row.id, row.name)
        }
      }
      const away = nextGame.away_team_id ? nameBy.get(nextGame.away_team_id) ?? 'Away' : 'Away'
      const home = nextGame.home_team_id ? nameBy.get(nextGame.home_team_id) ?? 'Home' : 'Home'
      const dt = new Date(nextGame.scheduled_at)
      const when = dt.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      nextGameStrip = {
        href: '/dashboard/games',
        title: `${away} @ ${home}`,
        when,
      }
    }
  }

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>
            {org?.name || 'My League'}
          </h1>
          <span className={`badge badge-${org?.plan || 'basic'}`}>
            {org?.plan || 'basic'}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Here&apos;s your league at a glance
        </p>
      </div>

      {nextGameStrip ? (
        <Link
          href={nextGameStrip.href}
          className="card"
          style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'var(--accent-muted)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <CalendarClock size={22} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Next game
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
              {nextGameStrip.title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{nextGameStrip.when}</div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            Games →
          </span>
        </Link>
      ) : null}

      {/* Stats */}
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div className="stat-card">
          <div className="stat-number" style={{ color: 'var(--accent)' }}>
            {playerCount ?? 0}
          </div>
          <div className="stat-label">Registered Players</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{teamCount ?? 0}</div>
          <div className="stat-label">Active Teams</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{seasonCount ?? 0}</div>
          <div className="stat-label">Seasons</div>
        </div>
      </div>

      {/* Registration Link */}
      {org?.slug && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <span className="label">Share with players</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Copy links from{' '}
            <Link href="/dashboard/settings?tab=league" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              Settings
            </Link>{' '}
            or{' '}
            <Link href="/dashboard/league-site" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              League website
            </Link>
            .
          </p>
        </div>
      )}

      {/* Upgrade prompt for basic */}
      {org?.plan === 'basic' && (
        <div className="upgrade-banner" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: '700', color: 'var(--accent-text)', marginBottom: '2px', fontSize: '14px' }}>
                Upgrade to Pro
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Unlock 150 players, 3 seasons, custom branding and live scoring
              </p>
            </div>
            <Link href="/dashboard/settings" style={{ textDecoration: 'none' }}>
              <button className="btn-primary">Upgrade — $49/mo</button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
