import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser, getOrgAccessForOrganization } from '@/lib/org-access'
import { EMPTY_LEAGUE_SITE, parseLeagueSitePayload } from '@/lib/league-site'
import { countGalleryImages, maxGalleryImagesForPlan } from '@/lib/league-site-limits'
import { isBasic, normalizeOrgPlan } from '@/lib/org-plan-tier'
import { proBrandColorChangesRemaining, PRO_BRAND_COLOR_CHANGES_PER_MONTH } from '@/lib/pro-brand-color-limits'
import { appearanceModeForChoice, normalizeLeagueThemePresetId } from '@/lib/league-theme-choice'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgIdParam = new URL(req.url).searchParams.get('organization_id')?.trim() || ''
  const access = orgIdParam
    ? await getOrgAccessForOrganization(userId, orgIdParam)
    : await getOrgAccessForClerkUser(userId)
  if (!access) {
    return NextResponse.json(
      { error: orgIdParam ? 'No access to this organization.' : 'No organization' },
      { status: 404 }
    )
  }

  const { data: row } = await supabaseAdmin
    .from('league_site_content')
    .select('draft, published, updated_at')
    .eq('organization_id', access.organization.id)
    .maybeSingle()

  const draft = parseLeagueSitePayload(row?.draft ?? EMPTY_LEAGUE_SITE)
  const published = parseLeagueSitePayload(row?.published ?? EMPTY_LEAGUE_SITE)

  let orgMetaRow: {
    plan?: string | null
    primary_color?: string | null
    league_theme_preset?: string | null
    league_appearance_mode?: string | null
    brand_color_change_count?: number | null
    brand_color_change_period_start?: string | null
    custom_domain?: string | null
    custom_domain_verified_at?: string | null
  } | null = null

  const wide = await supabaseAdmin
    .from('organizations')
    .select(
      'plan, primary_color, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start, custom_domain, custom_domain_verified_at'
    )
    .eq('id', access.organization.id)
    .maybeSingle()

  if (!wide.error && wide.data) {
    orgMetaRow = wide.data
  } else {
    const narrow = await supabaseAdmin
      .from('organizations')
      .select(
        'plan, primary_color, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start'
      )
      .eq('id', access.organization.id)
      .maybeSingle()
    orgMetaRow = narrow.data
  }

  const plan = normalizeOrgPlan(orgMetaRow?.plan)
  const maxG = maxGalleryImagesForPlan(plan)
  const themeChoice = normalizeLeagueThemePresetId(
    orgMetaRow?.league_theme_preset,
    orgMetaRow?.league_appearance_mode
  )

  const cd = orgMetaRow
  const verifiedFanHostname =
    cd?.custom_domain && cd.custom_domain_verified_at
      ? String(cd.custom_domain).trim().toLowerCase()
      : null

  return NextResponse.json({
    draft,
    published,
    updatedAt: row?.updated_at ?? null,
    role: access.role,
    slug: access.organization.slug,
    /** Same as `appearance.plan` — convenience for dashboard clients that read `data.plan`. */
    plan,
    maxGalleryImages: maxG,
    appearance: {
      plan,
      primaryColor: orgMetaRow?.primary_color ?? null,
      leagueThemePreset: themeChoice,
      leagueAppearanceMode: appearanceModeForChoice(themeChoice),
      proBrandColorChangesRemaining: proBrandColorChangesRemaining(orgMetaRow || {}),
      proBrandColorChangesMonthlyLimit: PRO_BRAND_COLOR_CHANGES_PER_MONTH,
    },
    verifiedFanHostname,
  })
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { draft?: unknown; publish?: boolean; organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const orgIdBody = typeof body.organization_id === 'string' ? body.organization_id.trim() : ''
  const access = orgIdBody
    ? await getOrgAccessForOrganization(userId, orgIdBody)
    : await getOrgAccessForClerkUser(userId)
  if (!access) {
    return NextResponse.json(
      { error: orgIdBody ? 'No access to this organization.' : 'No organization' },
      { status: 404 }
    )
  }

  const { data: orgGate } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', access.organization.id)
    .maybeSingle()

  const planGate = normalizeOrgPlan(orgGate?.plan)
  if (isBasic(planGate)) {
    return NextResponse.json(
      {
        error:
          'Custom league website, hero image, and page sections are Pro and Enterprise features. Upgrade in Dashboard → Settings, then return here to edit.',
        planGate: 'basic',
      },
      { status: 403 }
    )
  }

  const { data: existing } = await supabaseAdmin
    .from('league_site_content')
    .select('draft, published')
    .eq('organization_id', access.organization.id)
    .maybeSingle()

  let draft = parseLeagueSitePayload(existing?.draft ?? EMPTY_LEAGUE_SITE)
  let published = parseLeagueSitePayload(existing?.published ?? EMPTY_LEAGUE_SITE)

  if (body.draft !== undefined) {
    draft = parseLeagueSitePayload(body.draft)
  }

  const { data: orgPlanPut } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', access.organization.id)
    .maybeSingle()

  const planPut = normalizeOrgPlan(orgPlanPut?.plan)
  const maxG = maxGalleryImagesForPlan(planPut)
  const galleryCount = countGalleryImages(draft)
  if (galleryCount > maxG) {
    return NextResponse.json(
      {
        error: `Your ${planPut} plan allows up to ${maxG} gallery photos across all media sections. Remove some images or upgrade.`,
        maxGalleryImages: maxG,
        galleryImageCount: galleryCount,
      },
      { status: 400 }
    )
  }

  if (body.publish === true) {
    published = draft
    revalidatePath(`/league/${access.organization.slug}`)
  }

  const payload = {
    organization_id: access.organization.id,
    draft,
    published,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin.from('league_site_content').upsert(payload, { onConflict: 'organization_id' })

  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, draft, published })
}
