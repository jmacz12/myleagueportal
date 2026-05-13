import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { isProOrEnterprise } from '@/lib/org-plan-tier'
import {
  customDomainTxtFqdn,
  suggestedCnameTargetHostname,
} from '@/lib/custom-domain'
import { dnsTxtContainsToken, validateOrgCustomDomainHostname } from '@/lib/custom-domain-node'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function newVerificationToken(): string {
  return randomBytes(24).toString('hex')
}

function isMissingCustomDomainColumns(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const m = String(error.message || '').toLowerCase()
  const c = String(error.code || '')
  return (
    c === '42703' ||
    (m.includes('custom_domain') && (m.includes('column') || m.includes('does not exist'))) ||
    (m.includes('schema') && m.includes('custom_domain'))
  )
}

const MIGRATION_HINT =
  'Database is missing custom domain columns. From the repo run: npm run db:apply-pending (needs DATABASE_URL or DIRECT_URL in .env.local), or run supabase/migrations/20260515120000_organizations_custom_domain.sql in the Supabase SQL editor.'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can manage custom domains.' }, { status: 403 })
  }

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('plan, custom_domain, custom_domain_verification_token, custom_domain_verified_at')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (error) {
    if (isMissingCustomDomainColumns(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json(
      { error: `Could not load organization (${String(error.message || 'database error')}).` },
      { status: 500 }
    )
  }
  if (!org) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  if (!isProOrEnterprise(org.plan)) {
    return NextResponse.json({
      planOk: false,
      verifiedHostname: null,
      pendingHostname: null,
      verificationToken: null,
      txtFqdn: null,
      cnameTarget: suggestedCnameTargetHostname(),
    })
  }

  const hostname = typeof org.custom_domain === 'string' ? org.custom_domain.trim().toLowerCase() : ''
  const verifiedAt = org.custom_domain_verified_at as string | null
  const token = typeof org.custom_domain_verification_token === 'string' ? org.custom_domain_verification_token : null
  const verified = !!hostname && !!verifiedAt

  return NextResponse.json({
    planOk: true,
    verifiedHostname: verified ? hostname : null,
    pendingHostname: !verified && hostname ? hostname : null,
    verificationToken: !verified && hostname && token ? token : null,
    txtFqdn: !verified && hostname ? customDomainTxtFqdn(hostname) : null,
    cnameTarget: suggestedCnameTargetHostname(),
    verifiedAt: verified ? verifiedAt : null,
  })
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can manage custom domains.' }, { status: 403 })
  }

  let body: { hostname?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('id, plan, custom_domain, custom_domain_verified_at')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (error) {
    if (isMissingCustomDomainColumns(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not load organization.' }, { status: 500 })
  }
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (!isProOrEnterprise(org.plan)) {
    return NextResponse.json(
      { error: 'Custom domains are available on Pro and Enterprise.' },
      { status: 403 }
    )
  }

  const raw = typeof body.hostname === 'string' ? body.hostname : ''
  if (!raw.trim()) {
    const { error: upErr } = await supabaseAdmin
      .from('organizations')
      .update({
        custom_domain: null,
        custom_domain_verification_token: null,
        custom_domain_verified_at: null,
      })
      .eq('id', org.id)
    if (upErr) return NextResponse.json({ error: 'Could not clear domain' }, { status: 500 })
    return NextResponse.json({ success: true, cleared: true })
  }

  const v = validateOrgCustomDomainHostname(raw)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: taken } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('custom_domain', v.hostname)
    .not('custom_domain_verified_at', 'is', null)
    .neq('id', org.id)
    .maybeSingle()

  if (taken) {
    return NextResponse.json(
      { error: 'That domain is already connected to another league on MyLeaguePortal.' },
      { status: 409 }
    )
  }

  const token = newVerificationToken()
  const { error: upErr } = await supabaseAdmin
    .from('organizations')
    .update({
      custom_domain: v.hostname,
      custom_domain_verification_token: token,
      custom_domain_verified_at: null,
    })
    .eq('id', org.id)

  if (upErr) {
    const msg = String(upErr.message || '')
    if (msg.includes('custom_domain') || msg.includes('schema')) {
      return NextResponse.json(
        {
          error:
            'Database is missing custom domain columns. Apply pending migrations (e.g. npm run db:apply-pending) or run the latest SQL migration for organizations.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Could not save hostname' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    hostname: v.hostname,
    verificationToken: token,
    txtFqdn: customDomainTxtFqdn(v.hostname),
    cnameTarget: suggestedCnameTargetHostname(),
  })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can manage custom domains.' }, { status: 403 })
  }

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('id, plan, slug, custom_domain, custom_domain_verification_token, custom_domain_verified_at')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (error) {
    if (isMissingCustomDomainColumns(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not load organization.' }, { status: 500 })
  }
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (!isProOrEnterprise(org.plan)) {
    return NextResponse.json({ error: 'Custom domains are available on Pro and Enterprise.' }, { status: 403 })
  }

  const hostname = typeof org.custom_domain === 'string' ? org.custom_domain.trim().toLowerCase() : ''
  const token = typeof org.custom_domain_verification_token === 'string' ? org.custom_domain_verification_token : ''
  if (!hostname || !token) {
    return NextResponse.json({ error: 'Save a hostname first, then add the DNS records we show you.' }, { status: 400 })
  }
  if (org.custom_domain_verified_at) {
    return NextResponse.json({ success: true, alreadyVerified: true, verifiedHostname: hostname })
  }

  const ok = await dnsTxtContainsToken(hostname, token)
  if (!ok) {
    return NextResponse.json(
      {
        verified: false,
        error:
          'DNS not detected yet. Add the TXT record exactly as shown, wait a few minutes for DNS to propagate, then try again.',
        txtFqdn: customDomainTxtFqdn(hostname),
      },
      { status: 400 }
    )
  }

  const { data: taken } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('custom_domain', hostname)
    .not('custom_domain_verified_at', 'is', null)
    .neq('id', org.id)
    .maybeSingle()

  if (taken) {
    return NextResponse.json(
      { error: 'That domain is already connected to another league on MyLeaguePortal.' },
      { status: 409 }
    )
  }

  const verifiedAt = new Date().toISOString()
  const { error: upErr } = await supabaseAdmin
    .from('organizations')
    .update({ custom_domain_verified_at: verifiedAt })
    .eq('id', org.id)

  if (upErr) {
    const msg = String(upErr.message || '')
    if (msg.includes('organizations_one_verified_custom_domain') || msg.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'That domain is already connected to another league on MyLeaguePortal.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Could not finalize verification' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    verified: true,
    verifiedHostname: hostname,
    verifiedAt,
    leaguePath: `/league/${encodeURIComponent(String(org.slug || ''))}`,
  })
}
