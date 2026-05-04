import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NewsBanner from '@/components/NewsBanner'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function DropinsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, news_banner, primary_color')
    .eq('slug', slug)
    .single()

  if (!org) return notFound()

  const { data: sessions } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6' }}>
      <NewsBanner message={org.news_banner} />

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href={`/join/${slug}`} style={{ color: '#5a7a2a', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>← Back to Home</Link>
        
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a0a', marginTop: '20px', marginBottom: '8px' }}>Available Drop-ins</h1>
        <p style={{ color: '#9a8c6a', marginBottom: '32px' }}>Select a session below to reserve your spot.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!sessions || sessions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #d4c9a8' }}>
              <p style={{ color: '#1a1a0a', fontWeight: '700' }}>No upcoming sessions found.</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1.5px solid #d4c97a33', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1a1a0a' }}>{session.title}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9a8c6a' }}>
                    {new Date(session.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '700', color: '#5a7a2a' }}>${session.price}</p>
                </div>
                <button style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' }}>JOIN</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}