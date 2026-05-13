import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Legacy `/games/[gameId]/scoreboard` URLs redirect to the league Stream tab
 * with the same game’s public box score (replaces the old standalone page).
 */
export default async function GameScoreboardRedirect({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  if (!gameId) redirect('/')

  const { data: game } = await supabaseAdmin
    .from('games')
    .select('organization_id')
    .eq('id', gameId)
    .maybeSingle()

  if (!game?.organization_id) redirect('/')

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', game.organization_id)
    .maybeSingle()

  const slug = org?.slug?.trim()
  if (!slug) redirect('/')

  redirect(`/league/${encodeURIComponent(slug)}?tab=stream&game=${encodeURIComponent(gameId)}`)
}
