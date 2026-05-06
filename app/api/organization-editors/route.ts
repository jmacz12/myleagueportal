import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireOwner(userId: string) {
  const access = await getOrgAccessForClerkUser(userId)
  if (!access || access.role !== 'owner') return null
  return access
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await requireOwner(userId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rows } = await supabaseAdmin
    .from('organization_editors')
    .select('id, clerk_user_id, invited_email, created_at')
    .eq('organization_id', access.organization.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ editors: rows ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await requireOwner(userId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const client = await clerkClient()
  const list = await client.users.getUserList({ emailAddress: [email], limit: 5 })
  const target = list.data[0]
  if (!target?.id) {
    return NextResponse.json(
      {
        error:
          'No Clerk account found for that email. Ask them to sign up once, then try again.',
      },
      { status: 404 }
    )
  }

  if (target.id === userId) {
    return NextResponse.json({ error: 'That user is already the league owner.' }, { status: 400 })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('clerk_user_id')
    .eq('id', access.organization.id)
    .single()

  if (org?.clerk_user_id === target.id) {
    return NextResponse.json({ error: 'That user is already the owner.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('organization_editors').upsert(
    {
      organization_id: access.organization.id,
      clerk_user_id: target.id,
      invited_email: email,
    },
    { onConflict: 'organization_id,clerk_user_id' }
  )

  if (error) {
    return NextResponse.json({ error: 'Could not add editor' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, clerkUserId: target.id })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await requireOwner(userId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const clerkUserId = searchParams.get('clerkUserId')?.trim()
  if (!clerkUserId) return NextResponse.json({ error: 'clerkUserId required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('organization_editors')
    .delete()
    .eq('organization_id', access.organization.id)
    .eq('clerk_user_id', clerkUserId)

  if (error) {
    return NextResponse.json({ error: 'Could not remove editor' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
