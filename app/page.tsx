import { auth } from '@clerk/nextjs/server'
import Image from 'next/image'
import Link from 'next/link'
import {
  CalendarDays,
  Check,
  Dices,
  FileText,
  Globe2,
  LayoutTemplate,
  Newspaper,
  Radio,
  Shirt,
  ShoppingBag,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { LandingSignedInHeroActions, LandingSignedInNav } from '@/components/marketing/LandingSignedInChrome'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

export default async function HomePage() {
  const { userId } = await auth()
  const orgAccess = userId ? await getOrgAccessForClerkUser(userId) : null
  const leagueSlug = orgAccess?.organization.slug ?? null

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: '#f2ead6', minHeight: '100vh' }}>
      {/* Sticky nav only — logo lives in hero */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#f2ead6',
        }}
      >
        <nav
          style={{
            background: '#f2ead6',
            borderBottom: '0.5px solid #d4c9a8',
            padding: '0 32px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '16px',
            flexWrap: 'wrap',
            rowGap: '8px',
          }}
        >
          {userId ? (
            <LandingSignedInNav leagueSlug={leagueSlug} />
          ) : (
            <>
              <Link href="/sign-in" style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a0a', textDecoration: 'none' }}>
                Sign In
              </Link>
              <Link
                href="/sign-up"
                style={{ background: '#1a1a0a', color: '#d4c97a', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}
              >
                Get Started Free
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero — same content rhythm as original; photo + overlay instead of flat cream */}
      <section style={{ position: 'relative', minHeight: 'min(72vh, 620px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 24px 48px' }}>
        <Image
          src="/marketing-hero-gym.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(26,26,10,0.82) 0%, rgba(26,26,10,0.65) 45%, rgba(26,26,10,0.78) 100%)',
          }}
          aria-hidden
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          {/* Logo: colored mark (cropped) + white wordmark — PNG wordmark is dark on transparent */}
          <div style={{ marginBottom: 'clamp(18px, 3.5vw, 28px)' }}>
            <Link
              href="/"
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', gap: 'clamp(10px, 2vw, 14px)' }}
              aria-label="MyLeaguePortal home"
            >
              <div
                style={{
                  width: 'min(280px, 82vw)',
                  height: 'clamp(100px, 22vw, 148px)',
                  overflow: 'hidden',
                  margin: '0 auto',
                }}
              >
                <img
                  src="/myleagueportal-logo.png"
                  alt=""
                  aria-hidden
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    display: 'block',
                  }}
                />
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '8px 22px',
                  borderRadius: '999px',
                  background: 'rgba(26, 26, 10, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  color: '#ffffff',
                  fontSize: 'clamp(1.15rem, 3.6vw, 1.7rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                }}
              >
                MyLeaguePortal
              </span>
            </Link>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(232,240,208,0.95)',
              border: '0.5px solid #8aaa4a',
              borderRadius: '99px',
              padding: '4px 14px',
              marginBottom: '20px',
            }}
          >
            <span style={{ width: '5px', height: '5px', background: '#5a7a2a', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#3a5a10', letterSpacing: '0.06em' }}>FREE TO START — NO CREDIT CARD REQUIRED</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: '800', color: '#f2ead6', lineHeight: '1.12', letterSpacing: '-0.02em', marginBottom: '12px' }}>
            The Command Centre for<br />
            <span style={{ color: '#d4c97a' }}>Sports League Organizers</span>
            <span
              style={{
                display: 'block',
                fontSize: 'clamp(16px, 2.6vw, 24px)',
                fontWeight: 700,
                color: 'rgba(242,234,214,0.94)',
                marginTop: '10px',
                letterSpacing: '-0.015em',
                lineHeight: 1.25,
              }}
            >
              — and team managers, captains & club leads
            </span>
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(242,234,214,0.88)', lineHeight: '1.65', maxWidth: '560px', margin: '0 auto 24px' }}>
            One place for schedules, live scores, sign-ups, and waivers—for organizers and team leads.
          </p>
          {userId ? (
            <LandingSignedInHeroActions leagueSlug={leagueSlug} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/sign-up" style={{ background: '#1a1a0a', color: '#d4c97a', borderRadius: '9px', padding: '13px 26px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
                  Start for Free →
                </Link>
                <Link href="/sign-in" style={{ background: 'white', color: '#1a1a0a', border: '0.5px solid #d4c9a8', borderRadius: '9px', padding: '13px 26px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
                  Sign In
                </Link>
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(242,234,214,0.55)', marginTop: '12px' }}>
                Free plan includes 50 players, 1 season, and full drop-in management.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Sports strip — unchanged */}
      <section style={{ background: '#1a1a0a', padding: '12px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap' }}>
          {['Soccer', 'Basketball', 'Football', 'Hockey', 'Tennis', 'Volleyball', 'More'].map((sport) => (
            <span key={sport} style={{ fontSize: '12px', fontWeight: '700', color: '#d4c97a', letterSpacing: '0.03em' }}>
              {sport}
            </span>
          ))}
        </div>
      </section>

      {/* Features — original grid + white cards */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: '800', color: '#1a1a0a', marginBottom: '10px', letterSpacing: '-0.01em' }}>
            What you get
          </h2>
          <p style={{ fontSize: '15px', color: '#6b5e3a', maxWidth: '520px', margin: '0 auto' }}>
            From your public league site and live scores to drop-ins and waivers.{' '}
            <span style={{ fontWeight: 700, color: '#5c4a2a' }}>Enterprise</span> adds a league shop and an AI assistant—see pricing below.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {(
            [
              {
                Icon: Globe2,
                title: 'League home & sign-ups',
                desc: 'Fans get a proper league site (schedule, teams, news, stream). Sign-up links stay separate for registering, drop-ins, and jersey picks.',
              },
              {
                Icon: Zap,
                title: 'Live scores fans can follow',
                desc: 'Score from the bench with clock and starters. Share a watch link; streams can show a live score bar that tracks the game.',
              },
              {
                Icon: Radio,
                title: 'Stream overlays (Pro & Enterprise)',
                desc: 'Pro: simple branded overlay for OBS. Enterprise: full custom layout, including room for sponsors—same live data underneath.',
              },
              {
                Icon: CalendarDays,
                title: 'One calendar for everything',
                desc: 'Season games and drop-ins live in one list. Logged-in players can see their own games highlighted on top of the full schedule.',
              },
              {
                Icon: Dices,
                title: 'Drop-ins & attendance',
                desc: 'Recurring nights, easy mobile sign-up, check-in, payments, and waitlists. Pro can auto-balance teams; organizers get attendance tiers (Gold / Silver / Bronze).',
              },
              {
                Icon: LayoutTemplate,
                title: 'League website & themes',
                desc: 'Edit your public pages from the dashboard—hero, news, and more—with editors you trust. Pro adds your colors and ready-made looks.',
              },
              {
                Icon: Shirt,
                title: 'Jersey number polls',
                desc: 'Players request numbers online; you see clashes in one table and lock in final jerseys when you are ready.',
              },
              {
                Icon: FileText,
                title: 'Waivers',
                desc: 'Different waivers for season vs drop-ins. Type them in or upload; Pro can pull text out of old PDFs so signing stays simple.',
              },
              {
                Icon: Newspaper,
                title: 'Team news & calendar',
                desc: 'Team leads post updates and events; fans can read them on the public team page together with big league news.',
              },
              {
                Icon: ShoppingBag,
                title: 'League shop (Enterprise)',
                desc: 'Enterprise leagues get a shop on their public pages—browse merch or fundraisers, with room to add on-site checkout when you turn it on.',
              },
              {
                Icon: Sparkles,
                title: 'AI setup assistant (Enterprise)',
                desc: 'Enterprise-only: describe changes in plain language; get draft updates for schedule, news, teams, and rosters. Nothing publishes until you approve it.',
              },
            ] satisfies { Icon: LucideIcon; title: string; desc: string }[]
          ).map(({ Icon, title, desc }) => (
            <div key={title} style={{ background: 'white', border: '0.5px solid #d4c9a8', borderRadius: '12px', padding: '22px' }}>
              <div style={{ color: '#5a7a2a', marginBottom: '10px', display: 'flex' }}>
                <Icon size={26} strokeWidth={1.5} aria-hidden />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a0a', marginBottom: '6px' }}>{title}</h3>
              <p style={{ fontSize: '13px', color: '#6b5e3a', lineHeight: '1.6', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — unchanged layout */}
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

      {/* Pricing — unchanged */}
      <section style={{ padding: '64px 24px', background: '#f2ead6' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: '800', color: '#1a1a0a', marginBottom: '10px', letterSpacing: '-0.01em' }}>
              Simple, transparent pricing
            </h2>
            <p style={{ fontSize: '15px', color: '#6b5e3a' }}>
              Start free. Upgrade when you need more.{' '}
              <span style={{ fontWeight: 700, color: '#5c4a2a' }}>League shop</span> and{' '}
              <span style={{ fontWeight: 700, color: '#5c4a2a' }}>AI assistant</span> are included on{' '}
              <span style={{ fontWeight: 700, color: '#5c4a2a' }}>Enterprise</span> only.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {[
              {
                name: 'Basic',
                price: 'Free',
                period: 'forever',
                color: '#9a8c6a',
                highlight: false,
                features: [
                  '50 players',
                  '1 active season',
                  '2 drop-in sessions',
                  'Digital waivers',
                  '30 day history',
                  'Public registration page',
                ],
              },
              {
                name: 'Pro',
                price: '$49',
                period: '/month',
                color: '#5a7a2a',
                highlight: true,
                features: [
                  '150 players',
                  '3 concurrent seasons',
                  '10 drop-in sessions',
                  'PDF waiver digitizer',
                  'Custom brand color',
                  'Drop-in team builder',
                  'Branded OBS stream overlay (template)',
                  '1 year history',
                  'Everything in Basic',
                ],
              },
              {
                name: 'Enterprise',
                price: '$149',
                period: '/month',
                color: '#7c3aed',
                highlight: false,
                features: [
                  'Unlimited players',
                  'Unlimited seasons',
                  'Unlimited drop-ins',
                  'White-label branding',
                  'Multi-admin access',
                  'Custom domain',
                  'Custom stream overlays & sponsor layouts',
                  'League shop — merch & fundraisers on your league site (browse + checkout when enabled)',
                  'AI assistant — plain-language drafts for schedule, news, teams & rosters (you approve)',
                  'Priority support',
                  'Everything in Pro',
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                style={{
                  background: plan.highlight ? 'white' : '#f8f5ec',
                  border: plan.highlight ? '2px solid #5a7a2a' : '0.5px solid #d4c9a8',
                  borderRadius: '14px',
                  padding: '26px',
                  position: 'relative',
                }}
              >
                {plan.highlight ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-11px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#5a7a2a',
                      color: 'white',
                      fontSize: '9px',
                      fontWeight: '800',
                      padding: '3px 12px',
                      borderRadius: '99px',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    MOST POPULAR
                  </div>
                ) : null}
                <div style={{ fontSize: '11px', fontWeight: '800', color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '34px', fontWeight: '800', color: '#1a1a0a', lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: '12px', color: '#9a8c6a' }}>{plan.period}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '20px' }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1a1a0a' }}>
                      <Check size={14} strokeWidth={2.5} style={{ color: plan.color, flexShrink: 0 }} aria-hidden />
                      {f}
                    </div>
                  ))}
                </div>
                <Link
                  href="/sign-up"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: plan.highlight ? '#1a1a0a' : 'transparent',
                    color: plan.highlight ? '#d4c97a' : '#1a1a0a',
                    border: plan.highlight ? 'none' : '0.5px solid #d4c9a8',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    textDecoration: 'none',
                  }}
                >
                  {plan.name === 'Basic' ? 'Get Started Free' : `Start ${plan.name}`}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — unchanged */}
      <section style={{ background: '#1a1a0a', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: '800', color: '#f2ead6', marginBottom: '12px', letterSpacing: '-0.01em' }}>
          Ready to run a better league?
        </h2>
        <p style={{ fontSize: '15px', color: '#9a8c6a', marginBottom: '28px', maxWidth: '400px', margin: '0 auto 28px' }}>
          Join organizers and team leads who have ditched the spreadsheets for a platform built for the job.
        </p>
        <Link href="/sign-up" style={{ background: '#d4c97a', color: '#1a1a0a', borderRadius: '9px', padding: '14px 32px', fontSize: '15px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
          Create Your Free Account →
        </Link>
      </section>

      {/* Footer — no logo image */}
      <footer style={{ background: '#f2ead6', borderTop: '0.5px solid #d4c9a8', padding: '28px 32px' }}>
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px 32px',
          }}
        >
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/sign-in" style={{ fontSize: '12px', color: '#9a8c6a', textDecoration: 'none', fontWeight: '600' }}>
              Sign In
            </Link>
            <Link href="/sign-up" style={{ fontSize: '12px', color: '#9a8c6a', textDecoration: 'none', fontWeight: '600' }}>
              Sign Up
            </Link>
          </div>
          <p style={{ fontSize: '11px', color: '#c8b98a', margin: 0 }}>© {new Date().getFullYear()} MyLeaguePortal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
