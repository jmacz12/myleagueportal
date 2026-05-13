/**
 * Client-side fetch helpers for organizer jersey poll actions
 * (Dashboard → Teams and Manage team → Logo & poll).
 */

export async function requestOpenJerseyPoll(teamId: string) {
  const res = await fetch('/api/jersey-polls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id: teamId }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, json }
}

export async function requestCloseJerseyPoll(pollId: string) {
  const res = await fetch(`/api/jersey-polls/${pollId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'close' }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, json }
}
