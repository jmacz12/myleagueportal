import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
          }}>
            <div style={{
              width: '26px', height: '26px',
              background: 'var(--logo-bg)',
              borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--btn-primary-text)', letterSpacing: '0.06em' }}>ML</span>
            </div>
            <span style={{
              fontSize: '13px', fontWeight: '800',
              color: 'var(--text-primary)', letterSpacing: '0.02em',
            }}>
              MYLEAGUEPORTAL
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Create your free account to get started
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  )
}