import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { isBasic } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

async function getAccessibleOrg(userId: string) {
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return null
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('id', access.organization.id)
    .maybeSingle()
  return org
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const org = await getAccessibleOrg(userId)
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  if (isBasic(org.plan)) {
    return NextResponse.json(
      { error: 'Team logo upload requires Pro or Enterprise.' },
      { status: 403 }
    )
  }

  const { teamId } = await params
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  const file = form.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Use JPG, PNG, WebP, or GIF' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 })
  }

  const ext =
    file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'gif'

  const path = `${org.id}/team-logos/${teamId}-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabaseAdmin.storage.from('league-site').upload(path, buf, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const { data: pub } = supabaseAdmin.storage.from('league-site').getPublicUrl(path)
  const logoUrl = pub.publicUrl
  const { error: dbErr } = await supabaseAdmin
    .from('teams')
    .update({ logo_url: logoUrl })
    .eq('id', teamId)
    .eq('organization_id', org.id)

  if (dbErr) return NextResponse.json({ error: 'Could not save team logo' }, { status: 500 })
  return NextResponse.json({ logo_url: logoUrl })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const org = await getAccessibleOrg(userId)
  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { teamId } = await params
  const { error } = await supabaseAdmin
    .from('teams')
    .update({ logo_url: null })
    .eq('id', teamId)
    .eq('organization_id', org.id)

  if (error) return NextResponse.json({ error: 'Could not clear team logo' }, { status: 500 })
  return NextResponse.json({ success: true })
}
