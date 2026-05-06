import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { appearanceModeForChoice, normalizeLeagueThemePresetId } from '@/lib/league-theme-choice'

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

  let { data: orgWithTz, error: orgWithTzError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, primary_color, logo_url, plan, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color, league_timezone, league_theme_preset, league_appearance_mode, brand_color_change_count, brand_color_change_period_start'
    )
    .eq('clerk_user_id', userId)
    .single()

  // Backward compatibility for databases that do not yet have league_timezone.
  const { data: orgWithoutTz } = orgWithTzError
    ? await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, primary_color, logo_url, plan, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color')
        .eq('clerk_user_id', userId)
        .single()
    : { data: null as any }

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
      }
      : null)

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  return NextResponse.json({ org })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan, primary_color, brand_color_change_count, brand_color_change_period_start')
    .eq('clerk_user_id', userId)
    .single()

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

  // Allow update of name, slug, and news_banner
  const updateData: any = {
    name,
    slug,
    news_banner,
    news_banner_color,
    league_timezone: league_timezone || null,
  }

  // Only allow color / theme / appearance mode on pro/enterprise
  if (org.plan !== 'basic') {
    updateData.primary_color = primary_color
    const tm = sanitizePresetAndMode(league_theme_preset, league_appearance_mode)
    updateData.league_theme_preset = tm.preset
    updateData.league_appearance_mode = tm.mode
  }

  if (org.plan === 'pro') {
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
      msg.includes('league_appearance_mode')
    ) {
      const fallbackUpdate = { ...updateData }
      delete fallbackUpdate.league_timezone
      delete fallbackUpdate.league_theme_preset
      delete fallbackUpdate.league_appearance_mode
      delete fallbackUpdate.brand_color_change_count
      delete fallbackUpdate.brand_color_change_period_start

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