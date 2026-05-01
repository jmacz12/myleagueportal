import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

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
          Welcome back — here's your league at a glance
        </p>
      </div>

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
            <span className="label">Player Registration Link</span>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Share this link so players can register for your league
            </p>
          </div>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '0.5px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: 'var(--accent)',
          }}>
            myleagueportal.com/join/{org.slug}
          </div>
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

      {/* Quick Actions */}
      <div className="card">
        <span className="label" style={{ display: 'block', marginBottom: '14px' }}>Quick Actions</span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/dashboard/seasons" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary">📅 Seasons</button>
          </Link>
          <Link href="/dashboard/teams" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary">◈ Teams</button>
          </Link>
          <Link href="/dashboard/players" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary">◉ Players</button>
          </Link>
          <Link href="/dashboard/settings" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary">⚙️ Settings</button>
          </Link>
        </div>
      </div>
    </div>
  )
}