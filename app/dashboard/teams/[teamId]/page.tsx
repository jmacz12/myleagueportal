'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function DashboardTeamRedirectToPublicManage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.teamId as string

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/teams')
      const json = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        router.replace('/dashboard/teams')
        return
      }
      const slug = typeof json.org_slug === 'string' ? json.org_slug : ''
      const teams = (json.teams || []) as { id: string }[]
      if (!slug || !teamId || !teams.some((t) => t.id === teamId)) {
        router.replace('/dashboard/teams')
        return
      }
      router.replace(`/league/${slug}/teams/${teamId}?manage=1`)
    })()
    return () => {
      cancelled = true
    }
  }, [teamId, router])

  return <div style={{ padding: '40px 0', color: 'var(--text-muted)' }}>Opening public team page…</div>
}
