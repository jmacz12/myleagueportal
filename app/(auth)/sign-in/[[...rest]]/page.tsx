import { SignIn } from '@clerk/nextjs'
import { Check } from 'lucide-react'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Branding panel — desktop only */}
      <div className="auth-branding" style={{
        display: 'none',
        width: '400px',
        marginRight: '64px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'var(--logo-bg)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--btn-primary-text)', letterSpacing: '0.06em' }}>ML</span>
          </div>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            MYLEAGUEPORTAL
          </span>
        </div>

        <h1 style={{
          fontSize: '32px', fontWeight: '800',
          color: 'var(--text-primary)', lineHeight: '1.2', marginBottom: '14px',
        }}>
          The smarter way to run your league or team
        </h1>
        <p style={{
          fontSize: '15px', color: 'var(--text-secondary)',
          lineHeight: '1.7', marginBottom: '36px',
        }}>
          Manage registrations, rosters, and live game stats — all in one place. No more messy group chats.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            'Player registration pages in minutes',
            'Real-time live scoring table',
            'Automatic roster & team management',
            'Works for any sport or league size',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '20px', height: '20px',
                background: 'var(--accent-muted)',
                border: '0.5px solid var(--accent)',
                borderRadius: '99px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={12} strokeWidth={2.5} style={{ color: 'var(--accent)' }} aria-hidden />
              </div>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clerk sign in */}
      <div>
        <SignIn fallbackRedirectUrl="/" />
      </div>
    </div>
  )
}