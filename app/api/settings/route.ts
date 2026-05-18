import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { appearanceModeForChoice, normalizeLeagueThemePresetId } from '@/lib/league-theme-choice'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import {
  evaluateLeagueIdentityChange,
  leagueIdentityFieldsChanged,
} from '@/lib/league-identity-change-policy'
import { demoPlanSwitcherAllowed } from '@/lib/demo-plan-switcher'
import { isPro, isProOrEnterprise } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRO_BRAND_COLOR_CHANGES_PER_MONTH = 5

function startOfCurrentPeriodIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

function sanitizePresetAndMode(value: unknown, modeHint: unknown): { preset: string; mode: string } {
  const choice = normalizeLeagueThemePresetId(value, modeHint)
  return { preset: choice, mode: appearanceModeForChoice(choice) }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can manage league settings.' }, { status: 403 })
  }

  let { data: orgWithTz, error: orgWithTzError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, primary_color, logo_url, plan, plan_complimentary, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color, league_timezone, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start, league_name_change_count, league_name_last_changed_at, game_email_reminders_enabled'
    )
    .eq('id', access.organization.id)
    .single()

  // DB without league identity columns yet — retry without them.
  if (orgWithTzError) {
    const r2 = await supabaseAdmin
      .from('organizations')
      .select(
        'id, name, slug, primary_color, logo_url, plan, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color, league_timezone, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start, plan_complimentary'
      )
      .eq('id', access.organization.id)
      .single()
    if (!r2.error && r2.data) {
      const r2Complimentary = (r2.data as { plan_complimentary?: boolean }).plan_complimentary === true
      orgWithTz = {
        ...r2.data,
        league_name_change_count: 0,
        league_name_last_changed_at: null,
        game_email_reminders_enabled: true,
        plan_complimentary: r2Complimentary,
      } as typeof orgWithTz
      orgWithTzError = null
    }
  }

  // Backward compatibility for databases that do not yet have league_timezone.
  const { data: orgWithoutTz } = orgWithTzError
    ? await supabaseAdmin
        .from('organizations')
        .select(
          'id, name, slug, primary_color, logo_url, plan, plan_complimentary, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color'
        )
        .eq('id', access.organization.id)
        .single()
    : { data: null }

  const org =
    orgWithTz ||
    (orgWithoutTz
      ? {
        ...orgWithoutTz,
        league_timezone: null,
        league_theme_preset: 'classic',
        league_appearance_mode: 'light',
        brand_color_change_count: 0,
        brand_color_change_period_start: null,
        league_name_change_count: 0,
        league_name_last_changed_at: null,
        game_email_reminders_enabled: true,
        plan_complimentary:
          (orgWithoutTz as { plan_complimentary?: boolean }).plan_complimentary === true,
      }
      : null)

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const planComplimentary = (org as { plan_complimentary?: boolean }).plan_complimentary === true
  const slug = typeof org.slug === 'string' ? org.slug : ''

  const orgOut = {
    ...org,
    game_email_reminders_enabled:
      (org as { game_email_reminders_enabled?: boolean }).game_email_reminders_enabled !== false,
    plan_complimentary: planComplimentary,
    demo_plan_switcher_enabled: demoPlanSwitcherAllowed(slug, planComplimentary),
  }

  return NextResponse.json({ org: orgOut })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can manage league settings.' }, { status: 403 })
  }

  let { data: org, error: orgFetchError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, plan, primary_color, brand_color_change_count, brand_color_change_period_start, league_name_change_count, league_name_last_changed_at'
    )
    .eq('id', access.organization.id)
    .single()

  if (orgFetchError || !org) {
    const r2 = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan, primary_color, brand_color_change_count, brand_color_change_period_start')
      .eq('id', access.organization.id)
      .single()
    if (r2.data) {
      org = {
        ...r2.data,
        league_name_change_count: 0,
        league_name_last_changed_at: null,
      } as typeof org
      orgFetchError = null
    }
  }

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const {
    name,
    slug,
    primary_color,
    news_banner,
    news_banner_color,
    league_timezone,
    league_theme_preset,
    league_appearance_mode,
    game_email_reminders_enabled,
  } = await req.json()

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
  }

  // Check if slug is taken by someone else
  const { data: existing } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', org.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'That URL is already taken. Please choose a different one.' },
      { status: 400 }
    )
  }

  const identityPolicy = evaluateLeagueIdentityChange({
    plan: org.plan,
    storedName: org.name,
    storedSlug: org.slug,
    incomingName: name,
    incomingSlug: slug,
    changeCount: org.league_name_change_count,
    lastChangedAt: org.league_name_last_changed_at,
  })
  if (!identityPolicy.ok) {
    return NextResponse.json(
      { error: identityPolicy.error, nextEligibleAt: identityPolicy.nextEligibleAt },
      { status: 400 }
    )
  }

  const identityApplied = leagueIdentityFieldsChanged({
    storedName: org.name,
    storedSlug: org.slug,
    incomingName: name,
    incomingSlug: slug,
  })

  const updateData: Record<string, unknown> = {
    name,
    slug,
    league_timezone: league_timezone || null,
  }

  // Pro / Enterprise: brand, theme, news banner, reminder toggle
  if (isProOrEnterprise(org.plan)) {
    updateData.news_banner = news_banner
    updateData.news_banner_color = news_banner_color
    updateData.primary_color = primary_color
    const tm = sanitizePresetAndMode(league_theme_preset, league_appearance_mode)
    updateData.league_theme_preset = tm.preset
    updateData.league_appearance_mode = tm.mode
    if (typeof game_email_reminders_enabled === 'boolean') {
      updateData.game_email_reminders_enabled = game_email_reminders_enabled
    }
  }

  if (isPro(org.plan)) {
    const incomingColor = typeof primary_color === 'string' ? primary_color.trim().toLowerCase() : ''
    const existingColor = String(org.primary_color || '').trim().toLowerCase()
    const colorChanged = !!incomingColor && incomingColor !== existingColor
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
    } else {
      updateData.brand_color_change_count = org.brand_color_change_count ?? 0
      updateData.brand_color_change_period_start =
        org.brand_color_change_period_start ?? startOfCurrentPeriodIso()
    }
  }

  if (identityApplied) {
    updateData.league_name_change_count = (org.league_name_change_count ?? 0) + 1
    updateData.league_name_last_changed_at = new Date().toISOString()
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updateData)
    .eq('id', org.id)

  if (error) {
    const msg = String(error.message || '')
    // Backward compatibility: retry without newly-added columns if database is behind migrations.
    if (
      msg.includes('league_timezone') ||
      msg.includes('league_theme_preset') ||
      msg.includes('brand_color_change_count') ||
      msg.includes('brand_color_change_period_start') ||
      msg.includes('league_appearance_mode') ||
      msg.includes('league_name_change_count') ||
      msg.includes('league_name_last_changed_at')
    ) {
      const fallbackUpdate = { ...updateData }
      delete fallbackUpdate.league_timezone
      delete fallbackUpdate.league_theme_preset
      delete fallbackUpdate.league_appearance_mode
      delete fallbackUpdate.brand_color_change_count
      delete fallbackUpdate.brand_color_change_period_start
      delete fallbackUpdate.league_name_change_count
      delete fallbackUpdate.league_name_last_changed_at

      const { error: fallbackError } = await supabaseAdmin
        .from('organizations')
        .update(fallbackUpdate)
        .eq('id', org.id)

      if (fallbackError) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
      return NextResponse.json({
        success: true,
        warning:
          'Saved, but some newer league profile settings are unavailable until the latest database migrations are applied.',
      })
    }
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}