import { redirect } from 'next/navigation'

/** Legacy URL: public team pages live under `/league/[slug]/teams/[teamId]`. */
export default async function JoinTeamRedirect({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>
}) {
  const { slug, teamId } = await params
  redirect(`/league/${slug}/teams/${teamId}`)
}
