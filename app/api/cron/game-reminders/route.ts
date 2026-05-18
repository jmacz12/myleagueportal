import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runGameReminders } from '@/lib/run-game-reminders'
import { runRegistrationOpensEmails } from '@/lib/run-registration-opens-emails'
import { runDropinReminders } from '@/lib/run-dropin-reminders'
import { runLeagueNewsEmails } from '@/lib/run-league-news-emails'
import { runStatsHighlightEmails } from '@/lib/run-stats-highlight-emails'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Daily (Vercel Hobby): fan email alerts — games, registration, drop-in, news, stats (Pro/Enterprise). */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1'

  const [gameReminders, registrationOpens, dropinReminders, leagueNews, statsHighlights] =
    await Promise.all([
      runGameReminders(supabaseAdmin, { dryRun }),
      runRegistrationOpensEmails(supabaseAdmin, { dryRun }),
      runDropinReminders(supabaseAdmin, { dryRun }),
      runLeagueNewsEmails(supabaseAdmin, { dryRun }),
      runStatsHighlightEmails(supabaseAdmin, { dryRun }),
    ])

  return NextResponse.json({
    message: dryRun ? 'Fan email alerts dry run complete' : 'Fan email alerts processed',
    gameReminders,
    registrationOpens,
    dropinReminders,
    leagueNews,
    statsHighlights,
  })
}
