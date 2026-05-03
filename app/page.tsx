import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: '#f2ead6', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ background: '#f2ead6', borderBottom: '0.5px solid #d4c9a8', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="MyLeaguePortal" style={{ height: '36px', objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/sign-in" style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a0a', textDecoration: 'none' }}>
            Sign In
          </Link>
          <Link href="/sign-up" style={{ background: '#1a1a0a', color: '#d4c97a', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e8f0d0', border: '0.5px solid #8aaa4a', borderRadius: '99px', padding: '5px 14px', marginBottom: '24px' }}>
          <span style={{ width: '6px', height: '6px', background: '#5a7a2a', borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#3a5a10', letterSpacing: '0.05em' }}>FREE TO START — NO CREDIT CARD REQUIRED</span>
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: '800', color: '#1a1a0a', lineHeight: '1.15', letterSpacing: '-0.02em', marginBottom: '20px' }}>
          The Command Centre for<br />
          <span style={{ color: '#5a7a2a' }}>Sports League Organizers</span>
        </h1>
        <p style={{ fontSize: '18px', color: '#6b5e3a', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 36px' }}>
          Manage seasons, schedule games, run drop-ins, track players, and collect digital waivers — all in one platform built for organizers who mean business.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ background: '#1a1a0a', color: '#d4c97a', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
            Start for Free →
          </Link>
          <Link href="/sign-in" style={{ background: 'white', color: '#1a1a0a', border: '0.5px solid #d4c9a8', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
            Sign In
          </Link>
        </div>
        <p style={{ fontSize: '12px', color: '#9a8c6a', marginTop: '14px' }}>
          Free plan includes 50 players, 1 season, and full drop-in management.
        </p>
      </section>

      {/* Sports strip */}
      <section style={{ background: '#1a1a0a', padding: '14px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          {['⚽ Soccer', '🏀 Basketball', '🏈 Football', '🏒 Hockey', '🎾 Tennis', '🏐 Volleyball', '+ More'].map((sport) => (
            <span key={sport} style={{ fontSize: '13px', fontWeight: '700', color: '#d4c97a', letterSpacing: '0.03em' }}>{sport}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: '800', color: '#1a1a0a', marginBottom: '12px', letterSpacing: '-0.01em' }}>
            Everything you need to run a league
          </h2>
          <p style={{ fontSize: '16px', color: '#6b5e3a', maxWidth: '500px', margin: '0 auto' }}>
            Stop juggling spreadsheets, group chats, and paper waivers. MyLeaguePortal brings it all together.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {[
            {
              icon: '📅',
              title: 'Season & Schedule Management',
              desc: 'Create seasons, schedule multiple games at once, and manage your full calendar in minutes.',
            },
            {
              icon: '⚡',
              title: 'Live Game Scoring',
              desc: 'Real-time scoring with a built-in game clock, period tracker, and per-player stat tracking.',
            },
            {
              icon: '🎲',
              title: 'Drop-in Session Management',
              desc: 'Schedule drop-ins, manage check-ins, collect payments, and auto-build balanced teams.',
            },
            {
              icon: '👥',
              title: 'Player Registration',
              desc: 'Share a public registration link. Players sign up, accept your waiver, and you\'re done.',
            },
            {
              icon: '📄',
              title: 'Digital Waiver System',
              desc: 'Upload your existing waiver PDF or type one from scratch. Every signature is recorded with a timestamp and IP address.',
            },
            {
              icon: '🛡️',
              title: 'Player Reputation Tracking',
              desc: 'Automatically track attendance, payments, and reliability. Gold, Silver, and Bronze tiers keep your roster accountable.',
            },
          ].map((feature) => (
            <div key={feature.title} style={{ background: 'white', border: '0.5px solid #d4c9a8', borderRadius: '14px', padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1a1a0a', marginBottom: '8px' }}>{feature.title}</h3>
              <p style={{ fontSize: '13px', color: '#6b5e3a', lineHeight: '1.6', margin: 0 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ background: '#1a1a0a', padding: '80px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: '800', color: '#f2ead6', marginBottom: '12px', letterSpacing: '-0.01em' }}>
              Simple, transparent pricing
            </h2>
            <p style={{ fontSize: '16px', color: '#9a8c6a', maxWidth: '400px', margin: '0 auto' }}>
              Start free. Upgrade when you need more.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {[
              {
                name: 'Basic',
                price: 'Free',
                period: 'forever',
                color: '#9a8c6a',
                features: ['50 players', '1 active season', '2 drop-in sessions', 'Digital waivers', '30 day history', 'Public registration page'],
              },
              {
                name: 'Pro',
                price: '$49',
                period: '/month',
                color: '#5a7a2a',
                highlight: true,
                features: ['150 players', '3 concurrent seasons', '10 drop-in sessions', 'PDF waiver digitizer', 'Custom brand color', 'Drop-in team builder', '1 year history', 'Everything in Basic'],
              },
              {
                name: 'Enterprise',
                price: '$149',
                period: '/month',
                color: '#7c3aed',
                features: ['Unlimited players', 'Unlimited seasons', 'Unlimited drop-ins', 'White-label branding', 'Multi-admin access', 'Custom domain', 'Priority support', 'Everything in Pro'],
              },
            ].map((plan) => (
              <div key={plan.name} style={{ background: plan.highlight ? '#f2ead6' : '#2a2a1a', border: plan.highlight ? '2px solid #5a7a2a' : '0.5px solid #3a3a2a', borderRadius: '14px', padding: '28px', position: 'relative' }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#5a7a2a', color: 'white', fontSize: '10px', fontWeight: '800', padding: '4px 14px', borderRadius: '99px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: '12px', fontWeight: '800', color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '36px', fontWeight: '800', color: plan.highlight ? '#1a1a0a' : '#f2ead6', lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: '13px', color: plan.highlight ? '#6b5e3a' : '#9a8c6a' }}>{plan.period}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: plan.highlight ? '#1a1a0a' : '#c8b98a' }}>
                      <span style={{ color: plan.color, fontWeight: '700', flexShrink: 0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <Link href="/sign-up" style={{ display: 'block', textAlign: 'center', background: plan.highlight ? '#1a1a0a' : '#2a2a1a', color: plan.highlight ? '#d4c97a' : '#f2ead6', border: plan.highlight ? 'none' : '0.5px solid #3a3a2a', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
                  {plan.name === 'Basic' ? 'Get Started Free' : `Start ${plan.name}`}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: '800', color: '#1a1a0a', marginBottom: '16px', letterSpacing: '-0.01em' }}>
          Ready to run a better league?
        </h2>
        <p style={{ fontSize: '16px', color: '#6b5e3a', marginBottom: '32px', maxWidth: '440px', margin: '0 auto 32px' }}>
          Join league organizers who have ditched the spreadsheets for a platform built for the job.
        </p>
        <Link href="/sign-up" style={{ background: '#1a1a0a', color: '#d4c97a', borderRadius: '10px', padding: '16px 36px', fontSize: '16px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
          Create Your Free Account →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '0.5px solid #d4c9a8', padding: '32px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="MyLeaguePortal" style={{ height: '28px', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/sign-in" style={{ fontSize: '12px', color: '#9a8c6a', textDecoration: 'none', fontWeight: '600' }}>Sign In</Link>
            <Link href="/sign-up" style={{ fontSize: '12px', color: '#9a8c6a', textDecoration: 'none', fontWeight: '600' }}>Sign Up</Link>
          </div>
          <p style={{ fontSize: '11px', color: '#c8b98a', margin: 0 }}>
            © {new Date().getFullYear()} MyLeaguePortal. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  )
}