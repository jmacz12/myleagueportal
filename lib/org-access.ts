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
    logo_url: string | null
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
    .select('id, slug, name, logo_url, clerk_user_id')
    .eq('id', organizationId)
    .maybeSingle()

  if (!org) return null

  const orgRow = {
    id: org.id,
    slug: org.slug,
    name: org.name,
    logo_url: typeof org.logo_url === 'string' && org.logo_url.trim() ? org.logo_url.trim() : null,
  }

  if (org.clerk_user_id === userId) {
    return { organization: orgRow, role: 'owner' }
  }

  const { data: editorRow } = await supabaseAdmin
    .from('organization_editors')
    .select('organization_id')
    .eq('clerk_user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (editorRow?.organization_id) {
    return { organization: orgRow, role: 'editor' }
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
    .select('id, slug, name, logo_url')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (owned) {
    return {
      organization: {
        id: owned.id,
        slug: owned.slug,
        name: owned.name,
        logo_url: typeof owned.logo_url === 'string' && owned.logo_url.trim() ? owned.logo_url.trim() : null,
      },
      role: 'owner',
    }
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
    .select('id, slug, name, logo_url')
    .eq('id', editorRow.organization_id)
    .single()

  if (!org) return null
  return {
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      logo_url: typeof org.logo_url === 'string' && org.logo_url.trim() ? org.logo_url.trim() : null,
    },
    role: 'editor',
  }
}

export type DashboardOwnerOrgGate =
  | { ok: true; organizationId: string }
  | { ok: false; status: 404 | 403; error: string }

/**
 * Dashboard routes for drop-ins / reputation: resolve org the same way as the rest of the app,
 * but require the **owner** (website-only `organization_editors` must not manage sessions).
 */
export async function requireOwnerOrgForDashboard(userId: string | null | undefined): Promise<DashboardOwnerOrgGate> {
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return { ok: false, status: 404, error: 'Not found' }
  if (access.role !== 'owner') {
    return { ok: false, status: 403, error: 'Only the league owner can manage this.' }
  }
  return { ok: true, organizationId: access.organization.id }
}
