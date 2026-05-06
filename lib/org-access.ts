import { createClient } from '@supabase/supabase-js'

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

  const { data: editorRow } = await supabaseAdmin
    .from('organization_editors')
    .select('organization_id')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!editorRow?.organization_id) return null

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, name')
    .eq('id', editorRow.organization_id)
    .single()

  if (!org) return null
  return { organization: org, role: 'editor' }
}
