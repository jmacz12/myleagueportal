import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runGameReminders } from '@/lib/run-game-reminders'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Daily (Vercel Hobby): email roster players ~24h before scheduled league games (Pro/Enterprise). */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1'

  const result = await runGameReminders(supabaseAdmin, { dryRun })

  return NextResponse.json({
    message: dryRun ? 'Game reminders dry run complete' : 'Game reminders processed',
    ...result,
  })
}
