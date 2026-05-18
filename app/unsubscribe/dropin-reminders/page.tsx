import type { CSSProperties, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifyFanAlertUnsubscribeToken } from '@/lib/fan-alert-unsubscribe-token'
import { optOutDropinReminder } from '@/lib/fan-alert-unsubscribe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PageProps = {
  searchParams: Promise<{ token?: string }>
}

export const metadata = {
  title: 'Unsubscribe — drop-in reminders',
  robots: 'noindex',
}

export default async function DropinRemindersUnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams
  const raw = typeof token === 'string' ? token.trim() : ''

  if (!raw) {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Drop-in reminder emails</h1>
        <p style={bodyStyle}>
          This page opens from the unsubscribe link in a drop-in reminder email.
        </p>
      </UnsubscribeShell>
    )
  }

  let parsed: ReturnType<typeof verifyFanAlertUnsubscribeToken> = null
  let configError = false
  try {
    parsed = verifyFanAlertUnsubscribeToken(raw)
  } catch {
    configError = true
  }

  if (configError) {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Something went wrong</h1>
        <p style={bodyStyle}>Unsubscribe is temporarily unavailable. Try again later.</p>
      </UnsubscribeShell>
    )
  }

  if (!parsed || parsed.scope !== 'dropin_reminder') {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Link not valid</h1>
        <p style={bodyStyle}>Use the link from your most recent drop-in reminder email.</p>
      </UnsubscribeShell>
    )
  }

  const result = await optOutDropinReminder(supabaseAdmin, parsed.entityId)

  if (!result.ok) {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Could not unsubscribe</h1>
        <p style={bodyStyle}>{result.error}</p>
      </UnsubscribeShell>
    )
  }

  return (
    <UnsubscribeShell>
      <h1 style={headingStyle}>You&apos;re unsubscribed</h1>
      <p style={bodyStyle}>
        You will not receive automated <strong>drop-in reminder</strong> emails for this sign-up.
      </p>
    </UnsubscribeShell>
  )
}

function UnsubscribeShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg-primary, #f5f0e6)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '28px 24px',
          borderRadius: '12px',
          border: '0.5px solid var(--border, #d4cfc4)',
          background: 'var(--bg-card, #fffef9)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        }}
      >
        {children}
        <p style={{ fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '24px', marginBottom: 0 }}>
          MyLeaguePortal
        </p>
      </div>
    </main>
  )
}

const headingStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '22px',
  fontWeight: 800,
  color: 'var(--text-primary, #1a1a1a)',
}

const bodyStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '15px',
  lineHeight: 1.55,
  color: 'var(--text-primary, #333)',
}
