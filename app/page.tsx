import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: '#f2ead6', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ background: '#f2ead6', borderBottom: '0.5px solid #d4c9a8', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <img src="/logo.png" alt="MyLeaguePortal" style={{ height: '32px', objectFit: 'contain', mixBlendMode: 'multiply' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/sign-in" style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a0a', textDecoration: 'none' }}>Sign In</Link>
          <Link href="/sign-up" style={{ background: '#1a1a0a', color: '#d4c97a', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '56px 24px 48px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e8f0d0', border: '0.5px solid #8aaa4a', borderRadius: '99px', padding: '4px 14px', marginBottom: '20px' }}>
          <span style={{ width: '5px', height: '5px', background: '#5a7a2a', borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#3a5a10', letterSpacing: '0.06em' }}>FREE TO START — NO CREDIT CARD REQUIRED</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: '800', color: '#1a1a0a', lineHeight: '1.12', letterSpacing: '-0.02em', marginBottom: '16px' }}>
          The Command Centre for<br />
          <span style={{ color: '#5a7a2a' }}>Sports League Organizers</span>
        </h1>
        <p style={{ fontSize: '16px', color: '#6b5e3a', lineHeight: '1.65', maxWidth: '520px', margin: '0 auto 28px' }}>
          Manage seasons, schedule games, run drop-ins, track players, and collect digital waivers — all in one platform built for organizers who mean business.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ background: '#1a1a0a', color: '#d4c97a', borderRadius: '9px', padding: '13px 26px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Start for Free →
          </Link>
          <Link href="/sign-in" style={{ background: 'white', color: '#1a1a0a', border: '0.5px solid #d4c9a8', borderRadius: '9px', padding: '13px 26px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
        <p style={{ fontSize: '11px', color: '#9a8c6a', marginTop: '12px' }}>
          Free plan includes 50 players, 1 season, and full drop-in management.
        </p>
      </section>

      {/* Sports strip */}
      <section style={{ background: '#1a1a0a', padding: '12px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap' }}>
          {['⚽ Soccer', '🏀 Basketball', '🏈 Football', '🏒 Hockey', '🎾 Tennis', '🏐 Volleyball', '+ More'].map((sport) => (
            <span key={sport} style={{ fontSize: '12px', fontWeight: '700', color: '#d4c97a', letterSpacing: '0.03em' }}>{sport}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: '800', color: '#1a1a0a', marginBottom: '10px', letterSpacing: '-0.01em' }}>
            Everything you need to run a league
          </h2>
          <p style={{ fontSize: '15px', color: '#6b5e3a', maxWidth: '440px', margin: '0 auto' }}>
            Stop juggling spreadsheets, group chats, and paper waivers. MyLeaguePortal brings it all together.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {[
            { icon: '📅', title: 'Season & Schedule Management', desc: 'Create seasons, schedule multiple games at once, and manage your full calendar in minutes.' },
            { icon: '⚡', title: 'Live Game Scoring', desc: 'Real-time scoring with a built-in game clock, period tracker, and per-player stat tracking.' },
            { icon: '🎲', title: 'Drop-in Session Management', desc: 'Schedule drop-ins, manage check-ins, collect payments, and auto-build balanced teams.' },
            { icon: '👥', title: 'Player Registration', desc: 'Share a public link. Players sign up, accept your waiver, and you\'re done.' },
            { icon: '📄', title: 'Digital Waiver System', desc: 'Upload your PDF waiver or type one. Every signature is recorded with timestamp and IP.' },
            { icon: '🛡️', title: 'Player Reputation Tracking', desc: 'Track attendance, payments, and reliability. Gold, Silver, and Bronze tiers keep your roster accountable.' },
          ].map((feature) => (
            <div key={feature.title} style={{ background: 'white', border: '0.5px solid #d4c9a8', borderRadius: '12px', padding: '22px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a0a', marginBottom: '6px' }}>{feature.title}</h3>
              <p style={{ fontSize: '13px', color: '#6b5e3a', lineHeight: '1.6', margin: 0 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: '#1a1a0a', padding: '64px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: '800', color: '#f2ead6', marginBottom: '10px', letterSpacing: '-0.01em' }}>
            Up and running in minutes
          </h2>
          <p style={{ fontSize: '15px', color: '#9a8c6a', marginBottom: '40px' }}>No setup fees. No training required.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {[
              { step: '01', title: 'Create your league', desc: 'Sign up and set up your organization in under 2 minutes.' },
              { step: '02', title: 'Add your season', desc: 'Create a season and share your registration link with players.' },
              { step: '03', title: 'Run your games', desc: 'Schedule games, track live scores, and manage stats in real time.' },
              { step: '04', title: 'Grow your league', desc: 'Use drop-ins, reputation tracking, and waivers to build a serious program.' },
            ].map((item) => (
              <div key={item.step} style={{ background: '#2a2a1a', border: '0.5px solid #3a3a2a', borderRadius: '12px', padding: '20px', textAlign: 'left' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#5a7a2a', letterSpacing: '0.08em', marginBottom: '10px' }}>{item.step}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#f2ead6', marginBottom: '6px' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: '#9a8c6a', lineHeight: '1.5' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '64px 24px', background: '#f2ead6' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: '800', color: '#1a1a0a', marginBottom: '10px', letterSpacing: '-0.01em' }}>
              Simple, transparent pricing
            </h2>
            <p style={{ fontSize: '15px', color: '#6b5e3a' }}>Start free. Upgrade when you need more.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {[
              {
                name: 'Basic', price: 'Free', period: 'forever', color: '#9a8c6a', dark: false,
                features: ['50 players', '1 active season', '2 drop-in sessions', 'Digital waivers', '30 day history', 'Public registration page'],
              },
              {
                name: 'Pro', price: '$49', period: '/month', color: '#5a7a2a', highlight: true, dark: false,
                features: ['150 players', '3 concurrent seasons', '10 drop-in sessions', 'PDF waiver digitizer', 'Custom brand color', 'Drop-in team builder', '1 year history', 'Everything in Basic'],
              },
              {
                name: 'Enterprise', price: '$149', period: '/month', color: '#7c3aed', dark: false,
                features: ['Unlimited players', 'Unlimited seasons', 'Unlimited drop-ins', 'White-label branding', 'Multi-admin access', 'Custom domain', 'Priority support', 'Everything in Pro'],
              },
            ].map((plan) => (
              <div key={plan.name} style={{ background: plan.highlight ? 'white' : '#f8f5ec', border: plan.highlight ? '2px solid #5a7a2a' : '0.5px solid #d4c9a8', borderRadius: '14px', padding: '26px', position: 'relative' }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', background: '#5a7a2a', color: 'white', fontSize: '9px', fontWeight: '800', padding: '3px 12px', borderRadius: '99px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: '11px', fontWeight: '800', color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '34px', fontWeight: '800', color: '#1a1a0a', lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: '12px', color: '#9a8c6a' }}>{plan.period}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '20px' }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1a1a0a' }}>
                      <span style={{ color: plan.color, fontWeight: '700', flexShrink: 0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <Link href="/sign-up" style={{ display: 'block', textAlign: 'center', background: plan.highlight ? '#1a1a0a' : 'transparent', color: plan.highlight ? '#d4c97a' : '#1a1a0a', border: plan.highlight ? 'none' : '0.5px solid #d4c9a8', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
                  {plan.name === 'Basic' ? 'Get Started Free' : `Start ${plan.name}`}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: '#1a1a0a', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: '800', color: '#f2ead6', marginBottom: '12px', letterSpacing: '-0.01em' }}>
          Ready to run a better league?
        </h2>
        <p style={{ fontSize: '15px', color: '#9a8c6a', marginBottom: '28px', maxWidth: '400px', margin: '0 auto 28px' }}>
          Join league organizers who have ditched the spreadsheets for a platform built for the job.
        </p>
        <Link href="/sign-up" style={{ background: '#d4c97a', color: '#1a1a0a', borderRadius: '9px', padding: '14px 32px', fontSize: '15px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
          Create Your Free Account →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ background: '#f2ead6', borderTop: '0.5px solid #d4c9a8', padding: '28px 32px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <img src="/logo.png" alt="MyLeaguePortal" style={{ height: '26px', objectFit: 'contain', mixBlendMode: 'multiply' }} />
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/sign-in" style={{ fontSize: '12px', color: '#9a8c6a', textDecoration: 'none', fontWeight: '600' }}>Sign In</Link>
            <Link href="/sign-up" style={{ fontSize: '12px', color: '#9a8c6a', textDecoration: 'none', fontWeight: '600' }}>Sign Up</Link>
          </div>
          <p style={{ fontSize: '11px', color: '#c8b98a', margin: 0 }}>© {new Date().getFullYear()} MyLeaguePortal. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}