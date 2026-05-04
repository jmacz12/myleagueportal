'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, ChevronLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import NewsBanner from '@/components/NewsBanner'
import { useParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DropinsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [org, setOrg] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [waiver, setWaiver] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Registration State
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [formData, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [agreedToWaiver, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    async function loadData() {
      const res = await fetch(`/api/join/${slug}/sessions`)
      const json = await res.json().catch(() => ({}))
      setSessions(Array.isArray(json.sessions) ? json.sessions : [])

      const orgData = json.organization
      if (orgData) {
        setOrg(orgData)
        const { data: wData } = await supabase.from('waivers').select('*').eq('organization_id', orgData.id).eq('type', 'dropin').eq('is_active', true).maybeSingle()
        setWaiver(wData)
      }
      setLoading(false)
    }
    loadData()
  }, [slug])

  const formatLocalTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const timeZone = org?.league_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone }),
      zone: date.toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone }).split(' ').pop() || '',
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (waiver && !agreedToWaiver) return alert('You must agree to the waiver.')
    setSubmitting(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: selectedSession.id,
        organization_id: org.id,
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        waiver_accepted: agreedToWaiver,
        waiver_id: waiver?.id ?? null,
      }),
    })

    if (res.ok) setRegistered(true)
    else alert('Registration failed. The session might be full.')
    setSubmitting(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '100px', color: '#9a8c6a' }}>Loading sessions...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NewsBanner message={org?.news_banner} color={org?.news_banner_color} />

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
        {!selectedSession ? (
          <>
            <Link href={`/join/${slug}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#5a7a2a', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>
              <ChevronLeft size={16} /> Back to Home
            </Link>
            
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a0a', marginTop: '20px', marginBottom: '8px' }}>Available Drop-ins</h1>
            <p style={{ color: '#9a8c6a', marginBottom: '32px' }}>Book your spot for an upcoming session.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sessions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #d4c9a8' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#5a7a2a' }}>
                    <CalendarDays size={36} strokeWidth={1.25} aria-hidden />
                  </div>
                  <p style={{ color: '#1a1a0a', fontWeight: '700', margin: 0 }}>No upcoming sessions</p>
                  <p style={{ color: '#9a8c6a', fontSize: '14px', margin: '8px 0 0' }}>Check back soon for new dates.</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const local = formatLocalTime(s.scheduled_at)
                  return (
                    <div key={s.id} style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #d4c9a8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#1a1a0a' }}>{s.name}</h3>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#9a8c6a' }}>
                          {local.day} @ {local.time} {local.zone}
                        </p>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#5a7a2a' }}>${s.fee_amount}</p>
                      </div>
                      <button onClick={() => setSelectedSession(s)} style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.05em' }}>JOIN</button>
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : registered ? (
          <div style={{ textAlign: 'center', background: 'white', padding: '48px 32px', borderRadius: '20px', border: '1px solid #d4c9a8' }}>
            <CheckCircle size={64} color="#5a7a2a" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a1a0a', marginBottom: '12px' }}>Spot Reserved!</h2>
            <p style={{ color: '#9a8c6a', lineHeight: '1.6', marginBottom: '32px' }}>
              You are registered for <strong>{selectedSession.name}</strong>. Please bring <strong>${selectedSession.fee_amount}</strong> to the session.
            </p>
            <button onClick={() => window.location.reload()} style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', width: '100%', padding: '16px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>DONE</button>
          </div>
        ) : (
          <div style={{ background: 'white', padding: '32px', borderRadius: '20px', border: '1px solid #d4c9a8' }}>
            <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: '#9a8c6a', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '20px' }}>← Cancel</button>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a0a', marginBottom: '4px' }}>Register for Session</h2>
            <p style={{ color: '#9a8c6a', fontSize: '14px', marginBottom: '24px' }}>{selectedSession.name}</p>
            
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input type="text" placeholder="First Name" required className="input" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d4c9a8' }} 
                onChange={e => setForm({...formData, firstName: e.target.value})} />
              <input type="text" placeholder="Last Name" required className="input" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d4c9a8' }} 
                onChange={e => setForm({...formData, lastName: e.target.value})} />
              <input type="email" placeholder="Email Address" required className="input" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d4c9a8' }} 
                onChange={e => setForm({...formData, email: e.target.value})} />
              
              {waiver && (
                <div style={{ background: '#f9f7f0', padding: '16px', borderRadius: '8px', border: '1px solid #e6dcc0' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' }}>{waiver.title}</h4>
                  <div style={{ height: '100px', overflowY: 'auto', fontSize: '11px', color: '#9a8c6a', marginBottom: '12px', lineHeight: '1.5' }}>{waiver.content}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: '#1a1a0a', cursor: 'pointer' }}>
                    <input type="checkbox" required checked={agreedToWaiver} onChange={e => setAgreed(e.target.checked)} />
                    I agree to the liability waiver
                  </label>
                </div>
              )}

              <button type="submit" disabled={submitting} style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', marginTop: '8px' }}>
                {submitting ? 'RESERVING...' : `CONFIRM SPOT — $${selectedSession.fee_amount}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}