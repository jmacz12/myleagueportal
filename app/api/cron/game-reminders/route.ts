import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runGameReminders } from '@/lib/run-game-reminders'
import { runRegistrationOpensEmails } from '@/lib/run-registration-opens-emails'
import { runDropinReminders } from '@/lib/run-dropin-reminders'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Daily (Vercel Hobby): fan email alerts — game reminders, registration opens, drop-in reminders (Pro/Enterprise). */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1'

  const [gameReminders, registrationOpens, dropinReminders] = await Promise.all([
    runGameReminders(supabaseAdmin, { dryRun }),
    runRegistrationOpensEmails(supabaseAdmin, { dryRun }),
    runDropinReminders(supabaseAdmin, { dryRun }),
  ])

  return NextResponse.json({
    message: dryRun ? 'Fan email alerts dry run complete' : 'Fan email alerts processed',
    gameReminders,
    registrationOpens,
    dropinReminders,
  })
}
