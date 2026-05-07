import Link from 'next/link'

export default function JoinIndexPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        background: '#f2ead6',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: '440px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a0a', margin: '0 0 12px' }}>
          League join links
        </h1>
        <p style={{ fontSize: '14px', color: '#6b5e3a', lineHeight: 1.55, margin: '0 0 20px' }}>
          Registration uses your league’s own URL. Ask your organizer for the link — it looks like{' '}
          <code style={{ fontSize: '12px', background: '#e8e0cc', padding: '2px 6px', borderRadius: '4px' }}>
            /join/your-league-name
          </code>
          , not <code style={{ fontSize: '12px', background: '#e8e0cc', padding: '2px 6px', borderRadius: '4px' }}>/join</code> alone.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
          <Link
            href="/"
            style={{
              background: '#1a1a0a',
              color: '#d4c97a',
              borderRadius: '9px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Home
          </Link>
          <Link
            href="/sign-in"
            style={{
              background: 'white',
              color: '#1a1a0a',
              border: '0.5px solid #d4c9a8',
              borderRadius: '9px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Sign in (organizers)
          </Link>
        </div>
      </div>
    </div>
  )
}
