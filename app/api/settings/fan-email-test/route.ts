import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import {
  FAN_EMAIL_TEST_KINDS,
  buildFanEmailTestMessage,
  isFanEmailTestKind,
  type FanEmailTestKind,
} from '@/lib/fan-email-test'
import { sendTransactionalEmail, isEmailDeliveryConfigured } from '@/lib/email/send-transactional'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can send test emails.' }, { status: 403 })
  }

  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json(
      {
        error:
          'Email is not configured on this server (missing Resend API key or from address). Contact support or check deploy env vars.',
      },
      { status: 503 }
    )
  }

  const body = await req.json()
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : ''
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address to send tests to.' }, { status: 400 })
  }

  let kinds: FanEmailTestKind[] = []
  if (body.kind === 'all') {
    kinds = [...FAN_EMAIL_TEST_KINDS]
  } else if (isFanEmailTestKind(body.kind)) {
    kinds = [body.kind]
  } else if (Array.isArray(body.kinds)) {
    kinds = body.kinds.filter(isFanEmailTestKind)
  }

  if (kinds.length === 0) {
    return NextResponse.json({ error: 'Choose at least one notification type to test.' }, { status: 400 })
  }

  const orgSelect =
    'id, name, slug, league_timezone, custom_domain, custom_domain_verified_at'
  let { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select(orgSelect)
    .eq('id', access.organization.id)
    .single()

  if (orgErr?.message?.includes('league_timezone')) {
    const retry = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, custom_domain, custom_domain_verified_at')
      .eq('id', access.organization.id)
      .single()
    org = retry.data ? { ...retry.data, league_timezone: null } : null
    orgErr = retry.error
  }

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Could not load league profile.' }, { status: 500 })
  }

  const verifiedDomain =
    org.custom_domain_verified_at && org.custom_domain?.trim()
      ? org.custom_domain.trim().toLowerCase()
      : null

  const orgCtx = {
    leagueName: String(org.name || 'Your league'),
    leagueSlug: String(org.slug || ''),
    leagueTimezone: (org as { league_timezone?: string | null }).league_timezone ?? null,
    verifiedCustomDomain: verifiedDomain,
  }

  const sent: FanEmailTestKind[] = []
  const skipped: string[] = []
  const errors: string[] = []

  for (const kind of kinds) {
    const mail = buildFanEmailTestMessage(kind, orgCtx)
    const res = await sendTransactionalEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })

    if (!res.ok) {
      errors.push(`${kind}: ${res.error}`)
      continue
    }
    if (res.skipped) {
      skipped.push(kind)
      continue
    }
    sent.push(kind)
  }

  if (sent.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join(' '), sent, skipped, errors }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    to,
    sent,
    skipped,
    errors,
  })
}
