import { createClient } from '@supabase/supabase-js'
import { normalizeJoinSlugParam } from '@/lib/join-public-org'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type OrgAccessRole = 'owner' | 'editor'

export type OrgAccess = {
  organization: {
    id: string
    slug: string
    name: string
  }
  role: OrgAccessRole
}

/** Role for a specific league — use on public routes where `slug` or `organizationId` is known. */
export async function getOrgAccessForOrganization(
  userId: string | null | undefined,
  organizationId: string
): Promise<OrgAccess | null> {
  if (!userId || !organizationId) return null

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, name, clerk_user_id')
    .eq('id', organizationId)
    .maybeSingle()

  if (!org) return null

  if (org.clerk_user_id === userId) {
    return { organization: { id: org.id, slug: org.slug, name: org.name }, role: 'owner' }
  }

  const { data: editorRow } = await supabaseAdmin
    .from('organization_editors')
    .select('organization_id')
    .eq('clerk_user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (editorRow?.organization_id) {
    return { organization: { id: org.id, slug: org.slug, name: org.name }, role: 'editor' }
  }

  return null
}

export async function getOrgAccessForClerkUserAndSlug(
  userId: string | null | undefined,
  rawSlug: string
): Promise<OrgAccess | null> {
  const slug = normalizeJoinSlugParam(rawSlug)
  if (!userId || !slug) return null

  const { data: exact } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  let orgId = exact?.id as string | undefined
  if (!orgId) {
    const { data: ci } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .ilike('slug', slug)
      .limit(2)
    if (ci?.length === 1) orgId = ci[0].id as string
  }

  if (!orgId) return null
  return getOrgAccessForOrganization(userId, orgId)
}

export async function getOrgAccessForClerkUser(userId: string | null | undefined): Promise<OrgAccess | null> {
  if (!userId) return null

  const { data: owned } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, name')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (owned) {
    return { organization: owned, role: 'owner' }
  }

  const { data: editorRows } = await supabaseAdmin
    .from('organization_editors')
    .select('organization_id')
    .eq('clerk_user_id', userId)
    .limit(1)

  const editorRow = editorRows?.[0]
  if (!editorRow?.organization_id) return null

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, name')
    .eq('id', editorRow.organization_id)
    .single()

  if (!org) return null
  return { organization: org, role: 'editor' }
}
