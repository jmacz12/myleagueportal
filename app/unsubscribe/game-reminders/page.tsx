import type { CSSProperties, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifyGameReminderUnsubscribeToken } from '@/lib/game-reminder-unsubscribe-token'
import { optOutPlayerGameReminders } from '@/lib/game-reminder-unsubscribe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PageProps = {
  searchParams: Promise<{ token?: string }>
}

export const metadata = {
  title: 'Unsubscribe — game reminders',
  robots: 'noindex',
}

export default async function GameRemindersUnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams
  const raw = typeof token === 'string' ? token.trim() : ''

  if (!raw) {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Game reminder emails</h1>
        <p style={bodyStyle}>
          This page opens from the unsubscribe link in a reminder email. If you received a game
          reminder by mistake, contact your league organizer.
        </p>
      </UnsubscribeShell>
    )
  }

  let playerId: string | null = null
  let configError = false
  try {
    playerId = verifyGameReminderUnsubscribeToken(raw)
  } catch {
    configError = true
  }

  if (configError) {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Something went wrong</h1>
        <p style={bodyStyle}>
          Unsubscribe is temporarily unavailable. Try again later or ask your league to turn off
          reminders for you.
        </p>
      </UnsubscribeShell>
    )
  }

  if (!playerId) {
    return (
      <UnsubscribeShell>
        <h1 style={headingStyle}>Link not valid</h1>
        <p style={bodyStyle}>
          This unsubscribe link is invalid or has expired. Use the link from your most recent game
          reminder email, or contact your league organizer.
        </p>
      </UnsubscribeShell>
    )
  }

  const result = await optOutPlayerGameReminders(supabaseAdmin, playerId)

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
        You will not receive automated <strong>game reminder</strong> emails from MyLeaguePortal for
        this roster entry.
      </p>
      <p style={{ ...bodyStyle, fontSize: '14px', color: 'var(--text-muted, #666)' }}>
        Your league may still contact you directly. To get reminders again, ask your organizer to
        re-enable them on your player profile.
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
