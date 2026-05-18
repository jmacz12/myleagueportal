import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyFanAlertUnsubscribeToken } from '@/lib/fan-alert-unsubscribe-token'
import { optOutDropinReminder } from '@/lib/fan-alert-unsubscribe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function handleUnsubscribe(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  let parsed: ReturnType<typeof verifyFanAlertUnsubscribeToken>
  try {
    parsed = verifyFanAlertUnsubscribeToken(token)
  } catch {
    return NextResponse.json({ error: 'Unsubscribe is not configured' }, { status: 503 })
  }

  if (!parsed || parsed.scope !== 'dropin_reminder') {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const result = await optOutDropinReminder(supabaseAdmin, parsed.entityId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })

  return new NextResponse(null, { status: 200 })
}

export async function POST(req: Request) {
  return handleUnsubscribe(req)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  const page = new URL('/unsubscribe/dropin-reminders', url.origin)
  if (token) page.searchParams.set('token', token)
  return NextResponse.redirect(page)
}
