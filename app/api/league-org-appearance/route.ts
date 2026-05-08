import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { appearanceModeForChoice, normalizeLeagueThemePresetId, type LeagueThemeChoiceId } from '@/lib/league-theme-choice'
import { sanitizeLeagueAppearanceMode } from '@/lib/public-league-branding'
import { proBrandColorChangesRemaining } from '@/lib/pro-brand-color-limits'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRO_BRAND_COLOR_CHANGES_PER_MONTH = 5

function startOfCurrentPeriodIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

function canonicalPresetAndMode(preset: unknown, modeHint: unknown): { preset: string; mode: string } {
  const choice = normalizeLeagueThemePresetId(preset, modeHint)
  return { preset: choice, mode: appearanceModeForChoice(choice) }
}

function normalizeHex(input: unknown): string | null {
  const raw = typeof input === 'string' ? input.trim() : ''
  const m = raw.match(/^#?([0-9a-fA-F]{6})$/)
  return m ? `#${m[1].toLowerCase()}` : null
}

/**
 * PATCH brand color + theme preset for the signed-in user's organization.
 * Owner-only (website editors manage content, not org billing/theme limits).
 * Mirrors dashboard Settings rules for Basic vs Pro limits.
 */
export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the league owner can change brand colors and theme presets.' },
      { status: 403 }
    )
  }

  let body: { primary_color?: unknown; league_theme_preset?: unknown; league_appearance_mode?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const wantsPreset = body.league_theme_preset !== undefined
  const wantsColor = body.primary_color !== undefined
  const wantsMode = body.league_appearance_mode !== undefined

  if (!wantsPreset && !wantsColor && !wantsMode) {
    return NextResponse.json(
      { error: 'Provide primary_color, league_theme_preset, and/or league_appearance_mode.' },
      { status: 400 }
    )
  }

  let colorNormalized: string | null | undefined
  if (wantsColor) {
    colorNormalized = normalizeHex(body.primary_color)
    if (!colorNormalized) {
      return NextResponse.json({ error: 'primary_color must be a #RRGGBB hex value.' }, { status: 400 })
    }
  }

  const fullSelect =
    'id, plan, primary_color, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start'
  const legacySelect = 'id, plan, primary_color'

  type OrgAppearanceFields = {
    id: string
    plan: string | null
    primary_color: string | null
    league_theme_preset: string
    league_appearance_mode: string
    brand_color_change_count: number
    brand_color_change_period_start: string | null
  }

  let { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select(fullSelect)
    .eq('id', access.organization.id)
    .maybeSingle()

  // Backward compatibility when newer appearance columns are missing in target DB.
  if (orgErr && String(orgErr.message || '').includes('column')) {
    const legacy = await supabaseAdmin
      .from('organizations')
      .select(legacySelect)
      .eq('id', access.organization.id)
      .maybeSingle()
    if (legacy.data) {
      org = {
        ...legacy.data,
        league_theme_preset: 'classic',
        league_appearance_mode: 'light',
        brand_color_change_count: 0,
        brand_color_change_period_start: null,
      } as OrgAppearanceFields
      orgErr = null
    }
  }

  if (!org) {
    const slugLookup = await supabaseAdmin
      .from('organizations')
      .select(fullSelect)
      .eq('slug', access.organization.slug)
      .maybeSingle()
    if (slugLookup.data) {
      org = slugLookup.data
      orgErr = null
    }
    if (!org && slugLookup.error && String(slugLookup.error.message || '').includes('column')) {
      const legacySlug = await supabaseAdmin
        .from('organizations')
        .select(legacySelect)
        .eq('slug', access.organization.slug)
        .maybeSingle()
      if (legacySlug.data) {
        org = {
          ...legacySlug.data,
          league_theme_preset: 'classic',
          league_appearance_mode: 'light',
          brand_color_change_count: 0,
          brand_color_change_period_start: null,
        } as OrgAppearanceFields
        orgErr = null
      }
    }
  }

  if (!org) {
    // Fallback: if org-access points to a stale/missing row, recover by owner mapping.
    const ownerLookup = await supabaseAdmin
      .from('organizations')
      .select(fullSelect)
      .eq('clerk_user_id', userId)
      .maybeSingle()
    if (ownerLookup.data) {
      org = ownerLookup.data
      orgErr = null
    }
    if (!org && ownerLookup.error && String(ownerLookup.error.message || '').includes('column')) {
      const legacyOwnerLookup = await supabaseAdmin
        .from('organizations')
        .select(legacySelect)
        .eq('clerk_user_id', userId)
        .maybeSingle()
      if (legacyOwnerLookup.data) {
        org = {
          ...legacyOwnerLookup.data,
          league_theme_preset: 'classic',
          league_appearance_mode: 'light',
          brand_color_change_count: 0,
          brand_color_change_period_start: null,
        } as OrgAppearanceFields
        orgErr = null
      }
    }
  }

  if (orgErr || !org) {
    return NextResponse.json(
      {
        error:
          'Organization not found for this signed-in account. Reopen Dashboard → Settings, then retry. If this persists, sign out/in and confirm you are in the correct league workspace.',
      },
      { status: 404 }
    )
  }

  let presetIncoming: string | undefined
  let modeIncoming: string | undefined
  if (wantsPreset) {
    const tm = canonicalPresetAndMode(body.league_theme_preset, body.league_appearance_mode)
    presetIncoming = tm.preset
    modeIncoming = tm.mode
  } else if (wantsMode) {
    const tm = canonicalPresetAndMode(org.league_theme_preset, body.league_appearance_mode)
    presetIncoming = tm.preset
    modeIncoming = tm.mode
  }

  const plan = typeof org.plan === 'string' ? org.plan : 'basic'

  if (plan === 'basic') {
    return NextResponse.json(
      {
        error:
          'Brand color and theme presets are available on Pro and Enterprise. Upgrade from Dashboard → Settings.',
      },
      { status: 403 }
    )
  }

  const updateData: Record<string, unknown> = {}

  if (presetIncoming !== undefined) {
    updateData.league_theme_preset = presetIncoming
  }
  if (modeIncoming !== undefined) {
    updateData.league_appearance_mode = modeIncoming
  }

  if (wantsColor && colorNormalized) {
    updateData.primary_color = colorNormalized
  }

  if (plan === 'pro' && wantsColor && colorNormalized) {
    const incomingLower = colorNormalized.trim().toLowerCase()
    const existingLower = String(org.primary_color || '').trim().toLowerCase()
    const colorChanged = incomingLower !== existingLower

    if (colorChanged) {
      const periodStart = org.brand_color_change_period_start
        ? new Date(org.brand_color_change_period_start as string)
        : null
      const now = new Date()
      const needsReset =
        !periodStart ||
        periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
        periodStart.getUTCMonth() !== now.getUTCMonth()
      const currentCount = needsReset ? 0 : Number(org.brand_color_change_count || 0)
      if (currentCount >= PRO_BRAND_COLOR_CHANGES_PER_MONTH) {
        return NextResponse.json(
          {
            error: `You have reached the Pro brand color limit (${PRO_BRAND_COLOR_CHANGES_PER_MONTH} changes this month).`,
          },
          { status: 400 }
        )
      }
      updateData.brand_color_change_count = currentCount + 1
      updateData.brand_color_change_period_start = needsReset
        ? startOfCurrentPeriodIso()
        : org.brand_color_change_period_start
      updateData.league_theme_preset = 'classic'
      updateData.league_appearance_mode = 'light'
    } else {
      updateData.brand_color_change_count = org.brand_color_change_count ?? 0
      updateData.brand_color_change_period_start =
        org.brand_color_change_period_start ?? startOfCurrentPeriodIso()
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('organizations').update(updateData).eq('id', org.id)

  if (error) {
    const msg = String(error.message || '')
    if (
      msg.includes('league_theme_preset') ||
      msg.includes('brand_color_change_count') ||
      msg.includes('brand_color_change_period_start') ||
      msg.includes('league_appearance_mode')
    ) {
      const fallback = { ...updateData }
      delete fallback.league_theme_preset
      delete fallback.brand_color_change_count
      delete fallback.brand_color_change_period_start
      delete fallback.league_appearance_mode
      const { error: fb } = await supabaseAdmin.from('organizations').update(fallback).eq('id', org.id)
      if (fb) return NextResponse.json({ error: 'Failed to save appearance' }, { status: 500 })
      return NextResponse.json({
        ok: true,
        warning:
          'Saved color; theme preset counters require the latest database migration. Finish migrating or use Dashboard → Settings.',
        organization: {
          primary_color: (fallback.primary_color as string) ?? org.primary_color,
          league_theme_preset: org.league_theme_preset,
          league_appearance_mode: sanitizeLeagueAppearanceMode(
            (org as { league_appearance_mode?: string }).league_appearance_mode
          ),
        },
        proBrandColorChangesRemaining: proBrandColorChangesRemaining({
          plan,
          brand_color_change_count: Number(updateData.brand_color_change_count ?? org.brand_color_change_count ?? 0),
          brand_color_change_period_start:
            typeof updateData.brand_color_change_period_start === 'string'
              ? updateData.brand_color_change_period_start
              : (org.brand_color_change_period_start as string | null),
        }),
        proBrandColorChangesMonthlyLimit: PRO_BRAND_COLOR_CHANGES_PER_MONTH,
      })
    }
    return NextResponse.json({ error: 'Failed to save appearance' }, { status: 500 })
  }

  const { data: fresh } = await supabaseAdmin
    .from('organizations')
    .select(
      'plan, primary_color, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start'
    )
    .eq('id', org.id)
    .single()

  const themeChoice = normalizeLeagueThemePresetId(
    fresh?.league_theme_preset,
    fresh?.league_appearance_mode
  ) as LeagueThemeChoiceId
  return NextResponse.json({
    ok: true,
    organization: {
      primary_color: fresh?.primary_color ?? org.primary_color,
      league_theme_preset: themeChoice,
      league_appearance_mode: appearanceModeForChoice(themeChoice),
    },
    proBrandColorChangesRemaining: proBrandColorChangesRemaining({
      plan: fresh?.plan ?? plan,
      brand_color_change_count: fresh?.brand_color_change_count ?? org.brand_color_change_count,
      brand_color_change_period_start:
        (fresh?.brand_color_change_period_start as string | null | undefined) ??
        (org.brand_color_change_period_start as string | null),
    }),
    proBrandColorChangesMonthlyLimit: PRO_BRAND_COLOR_CHANGES_PER_MONTH,
  })
}
