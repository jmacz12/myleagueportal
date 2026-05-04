'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CalendarDays, ChevronLeft, CheckCircle, Clock, DollarSign } from 'lucide-react'
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
        const { data: wData } = await supabase
          .from('waivers')
          .select('*')
          .eq('organization_id', orgData.id)
          .eq('type', 'dropin')
          .eq('is_active', true)
          .maybeSingle()
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

  if (loading) return <div className="min-h-screen bg-[#f2ead6] flex items-center justify-center text-[#1a1a0a] text-sm font-semibold">Loading sessions…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f2ead6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <NewsBanner message={org?.news_banner} color={org?.news_banner_color} />

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
        {!selectedSession ? (
          <>
            <Link href={`/join/${slug}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#5a7a2a', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>
              <ChevronLeft size={16} /> Back to Home
            </Link>
            
            <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#1a1a0a', marginTop: '20px', marginBottom: '8px', letterSpacing: '-0.02em' }}>Available Drop-ins</h1>
            <p style={{ color: '#9a8c6a', marginBottom: '32px' }}>Reserve your spot for upcoming games.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sessions.length === 0 ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', background: 'white', borderRadius: '20px', border: '1px solid #d4c9a8' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#5a7a2a' }}>
                    <CalendarDays size={40} strokeWidth={1.25} aria-hidden />
                  </div>
                  <h3 style={{ color: '#1a1a0a', margin: '0 0 8px' }}>No sessions scheduled</h3>
                  <p style={{ color: '#9a8c6a', margin: 0, fontSize: '14px' }}>Check back soon for new dates.</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const local = formatLocalTime(s.scheduled_at);
                  return (
                    <div key={s.id} style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid #d4c9a8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800', color: '#1a1a0a' }}>{s.name}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5a7a2a', fontSize: '13px', fontWeight: '700' }}>
                            <Clock size={14} /> {local.day} @ {local.time} {local.zone}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a8c6a', fontSize: '13px' }}>
                            <DollarSign size={14} /> ${s.fee_amount} per person
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setSelectedSession(s)} style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }}>JOIN</button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : registered ? (
          <div style={{ textAlign: 'center', background: 'white', padding: '48px 32px', borderRadius: '24px', border: '1px solid #d4c9a8', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <CheckCircle size={64} color="#5a7a2a" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a1a0a', marginBottom: '12px' }}>Spot Reserved!</h2>
            <p style={{ color: '#9a8c6a', lineHeight: '1.6', marginBottom: '32px' }}>
              You are registered for <strong>{selectedSession.name}</strong>. <br/>
              Payment of <strong>${selectedSession.fee_amount}</strong> will be collected at the venue.
            </p>
            <button onClick={() => window.location.href = `/join/${slug}/dropins`} style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', width: '100%', padding: '16px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>DONE</button>
          </div>
        ) : (
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #d4c9a8', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: '#9a8c6a', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '24px', fontWeight: '700' }}>← Change Session</button>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a1a0a', marginBottom: '4px', letterSpacing: '-0.02em' }}>Register Now</h2>
            <p style={{ color: '#5a7a2a', fontSize: '14px', fontWeight: '700', marginBottom: '24px' }}>{selectedSession.name}</p>
            
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input type="text" placeholder="First Name" required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #d4c9a8', fontSize: '14px' }} 
                  onChange={e => setForm({...formData, firstName: e.target.value})} />
                <input type="text" placeholder="Last Name" required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #d4c9a8', fontSize: '14px' }} 
                  onChange={e => setForm({...formData, lastName: e.target.value})} />
              </div>
              <input type="email" placeholder="Email Address" required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #d4c9a8', fontSize: '14px' }} 
                onChange={e => setForm({...formData, email: e.target.value})} />
              
              {waiver && (
                <div style={{ background: '#f9f7f0', padding: '20px', borderRadius: '12px', border: '1px solid #e6dcc0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#1a1a0a' }}>{waiver.title}</h4>
                  <div style={{ height: '120px', overflowY: 'auto', fontSize: '12px', color: '#9a8c6a', marginBottom: '16px', lineHeight: '1.6', paddingRight: '8px' }}>{waiver.content}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', color: '#1a1a0a', cursor: 'pointer' }}>
                    <input type="checkbox" required checked={agreedToWaiver} onChange={e => setAgreed(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    I agree to the liability waiver
                  </label>
                </div>
              )}

              <button type="submit" disabled={submitting} style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', padding: '18px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', marginTop: '8px', fontSize: '14px', letterSpacing: '0.05em' }}>
                {submitting ? 'RESERVING...' : `CONFIRM REGISTRATION — $${selectedSession.fee_amount}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}