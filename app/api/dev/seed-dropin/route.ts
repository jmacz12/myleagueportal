import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seedDropinDemo } from '@/lib/seed-dropin-demo'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Development only: recurring Mon/Wed 7–9pm drop-ins + populated next occurrences.
 *
 *   curl -X POST http://localhost:3000/api/dev/seed-dropin -H "Content-Type: application/json" -d "{\"slug\":\"your-slug\",\"months\":4}"
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  let slug = ''
  let months: number | undefined
  try {
    const body = await req.json()
    slug = typeof body.slug === 'string' ? body.slug : ''
    if (typeof body.months === 'number' && Number.isFinite(body.months)) months = body.months
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!slug.trim()) {
    return NextResponse.json({ error: 'Body must include { "slug": "your-league-slug" }' }, { status: 400 })
  }

  const result = await seedDropinDemo(supabaseAdmin, slug.trim(), { recurringMonths: months })

  if (!result.ok) {
    const status = /no organization/i.test(result.error) ? 404 : 500
    return NextResponse.json({ error: result.error, hint: result.hint }, { status })
  }

  return NextResponse.json(result)
}
