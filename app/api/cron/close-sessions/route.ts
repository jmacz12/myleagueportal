import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Close all sessions scheduled for yesterday or earlier
  const { data: sessionsToClose, error: fetchError } = await supabaseAdmin
    .from('dropin_sessions')
    .select('id, name')
    .eq('status', 'upcoming')
    .lt('scheduled_at', `${today}T00:00:00`)

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  if (!sessionsToClose || sessionsToClose.length === 0) {
    return NextResponse.json({ message: 'No sessions to close', count: 0 })
  }

  const ids = sessionsToClose.map(s => s.id)

  const { error: updateError } = await supabaseAdmin
    .from('dropin_sessions')
    .update({ status: 'closed' })
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to close sessions' }, { status: 500 })
  }

  return NextResponse.json({
    message: `Closed ${sessionsToClose.length} sessions`,
    count: sessionsToClose.length,
    sessions: sessionsToClose.map(s => s.name),
  })
}