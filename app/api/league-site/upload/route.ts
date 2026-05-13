import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser, getOrgAccessForOrganization } from '@/lib/org-access'
import { isBasic } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formInit = await req.formData().catch(() => null)
  if (!formInit) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const orgIdField = formInit.get('organization_id')
  const orgIdStr = typeof orgIdField === 'string' ? orgIdField.trim() : ''

  const access = orgIdStr
    ? await getOrgAccessForOrganization(userId, orgIdStr)
    : await getOrgAccessForClerkUser(userId)
  if (!access) {
    return NextResponse.json(
      { error: orgIdStr ? 'No access to this organization.' : 'No organization' },
      { status: 404 }
    )
  }

  const { data: orgPlan } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', access.organization.id)
    .maybeSingle()
  if (isBasic(orgPlan?.plan)) {
    return NextResponse.json(
      { error: 'Image uploads for the league website require Pro or Enterprise.' },
      { status: 403 }
    )
  }

  const form = formInit

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

  const path = `${access.organization.id}/${crypto.randomUUID()}.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabaseAdmin.storage.from('league-site').upload(path, buf, {
    contentType: file.type,
    upsert: false,
  })

  if (upErr) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = supabaseAdmin.storage.from('league-site').getPublicUrl(path)
  return NextResponse.json({ url: pub.publicUrl })
}
