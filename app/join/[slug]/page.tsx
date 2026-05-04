import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NewsBanner from '@/components/NewsBanner'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function LeagueHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, primary_color, logo_url, news_banner')
    .eq('slug', slug)
    .single()

  if (!org) return notFound()

  const accent = org.primary_color || '#5a7a2a'

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      
      <NewsBanner message={org.news_banner} />

      {/* Hero Header */}
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} style={{ height: '80px', margin: '0 auto 20px', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: '80px', height: '80px', background: '#e6dcc0', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto 20px' }}>🏟️</div>
        )}
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#1a1a0a', marginBottom: '8px' }}>{org.name}</h1>
        <p style={{ color: '#9a8c6a', fontSize: '16px' }}>Welcome to our official league portal.</p>
      </div>

      {/* Navigation Cards */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 20px 60px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <Link href={`/join/${slug}/register`} style={{ textDecoration: 'none' }}>
          <div style={{ background: '#1a1a0a', padding: '32px', borderRadius: '16px', border: `2px solid ${accent}`, cursor: 'pointer', transition: 'transform 0.2s' }}>
            <h2 style={{ color: '#d4c97a', fontSize: '20px', fontWeight: '800', marginBottom: '8px', textTransform: 'uppercase' }}>🏆 Full Season Registration</h2>
            <p style={{ color: '#f2ead6', opacity: 0.8, fontSize: '14px', margin: 0 }}>Join a team, view standings, and play the full schedule.</p>
          </div>
        </Link>

        <Link href={`/join/${slug}/dropins`} style={{ textDecoration: 'none' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #d4c9a8', cursor: 'pointer' }}>
            <h2 style={{ color: '#1a1a0a', fontSize: '20px', fontWeight: '800', marginBottom: '8px', textTransform: 'uppercase' }}>🎲 Single Drop-ins</h2>
            <p style={{ color: '#9a8c6a', fontSize: '14px', margin: 0 }}>Quick games, no commitment. Book your spot for an upcoming session.</p>
          </div>
        </Link>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <span style={{ fontSize: '12px', color: '#c8b98a' }}>
            Powered by <span style={{ fontWeight: '700', color: '#9a8c6a' }}>MyLeaguePortal</span>
          </span>
        </div>
      </div>
    </div>
  )
}