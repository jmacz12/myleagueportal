import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyGameReminderUnsubscribeToken } from '@/lib/game-reminder-unsubscribe-token'
import { optOutPlayerGameReminders } from '@/lib/game-reminder-unsubscribe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function tokenFromRequest(req: Request): string | null {
  const url = new URL(req.url)
  const q = url.searchParams.get('token')?.trim()
  if (q) return q
  return null
}

async function handleUnsubscribe(req: Request): Promise<NextResponse> {
  const token = tokenFromRequest(req)
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  let playerId: string | null
  try {
    playerId = verifyGameReminderUnsubscribeToken(token)
  } catch {
    return NextResponse.json({ error: 'Unsubscribe is not configured' }, { status: 503 })
  }

  if (!playerId) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const result = await optOutPlayerGameReminders(supabaseAdmin, playerId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return new NextResponse(null, { status: 200 })
}

/** RFC 8058 one-click unsubscribe (Gmail, etc.). */
export async function POST(req: Request) {
  return handleUnsubscribe(req)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.redirect(new URL('/unsubscribe/game-reminders', url.origin))
  }
  const page = new URL('/unsubscribe/game-reminders', url.origin)
  page.searchParams.set('token', token)
  return NextResponse.redirect(page)
}
