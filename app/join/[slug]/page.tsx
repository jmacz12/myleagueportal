import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import RegistrationForm from './RegistrationForm'
import NewsBanner from '@/components/NewsBanner'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, primary_color, logo_url, plan, news_banner')
    .eq('slug', slug)
    .single()

  if (!org) return notFound()

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: playerCount } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .eq('season_id', season?.id ?? '')

  const { data: waiver } = await supabaseAdmin
    .from('waivers')
    .select('id, title, content')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .maybeSingle()

  const limit = org.plan === 'basic' ? 50 : org.plan === 'pro' ? 150 : 99999
  const isFull = (playerCount ?? 0) >= limit
  const accent = org.primary_color || '#5a7a2a'
  const maxGuests = org.plan === 'basic' ? 1 : org.plan === 'pro' ? 5 : 999

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6' }}>
      
      {/* News Banner */}
      <NewsBanner message={org.news_banner} />

      {/* League Header */}
      <div style={{
        background: '#f2ead6',
        borderBottom: `3px solid ${accent}`,
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        {org.logo_url && (
          <img src={org.logo_url} alt={org.name}
            style={{ height: '56px', margin: '0 auto 12px', objectFit: 'contain', display: 'block' }} />
        )}
        {!org.logo_url && (
          <div style={{
            width: '56px', height: '56px',
            background: '#e6dcc0',
            border: '0.5px solid #c8b98a',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 12px',
          }}>⚡</div>
        )}
        <h1 style={{
          fontSize: '24px', fontWeight: '800',
          color: '#1a1a0a', marginBottom: '4px', letterSpacing: '-0.01em',
        }}>
          {org.name}
        </h1>
        {season && (
          <p style={{ fontSize: '13px', color: '#9a8c6a', marginBottom: '10px' }}>
            {season.name} · Registration Open
          </p>
        )}
        {!season && (
          <p style={{ fontSize: '13px', color: '#c8a060', marginBottom: '10px' }}>
            No active season right now
          </p>
        )}
        {season && !isFull && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: '#e8f0d0', border: '0.5px solid #8aaa4a',
            borderRadius: '99px', padding: '4px 12px',
          }}>
            <span style={{ width: '6px', height: '6px', background: '#5a7a2a', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#3a5a10', letterSpacing: '0.05em' }}>
              REGISTRATION OPEN
            </span>
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
        {!season ? (
          <div style={{
            background: 'white', border: '0.5px solid #d4c9a8',
            borderRadius: '14px', padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>⚡</div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a0a', marginBottom: '8px' }}>
              No Active Season
            </h2>
            <p style={{ fontSize: '13px', color: '#9a8c6a' }}>
              There's no active season open for registration right now. Check back soon!
            </p>
          </div>
        ) : isFull ? (
          <div style={{
            background: 'white', border: '0.5px solid #d4c9a8',
            borderRadius: '14px', padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>😔</div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a0a', marginBottom: '8px' }}>
              League is Full
            </h2>
            <p style={{ fontSize: '13px', color: '#9a8c6a' }}>
              This league has reached its player limit. Contact the organizer for more information.
            </p>
          </div>
        ) : (
          <RegistrationForm
            organizationId={org.id}
            seasonId={season.id}
            leagueName={org.name}
            primaryColor={accent}
            maxGuests={maxGuests}
            waiverTitle={waiver?.title || null}
            waiverText={waiver?.content || null}
            waiverId={waiver?.id || null}
          />
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '11px', color: '#c8b98a' }}>
            Powered by{' '}
            <span style={{ fontWeight: '700', color: '#9a8c6a' }}>MyLeaguePortal</span>
          </span>
        </div>
      </div>
    </div>
  )
}