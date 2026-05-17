/** Format a game start time for emails and UI using the league IANA timezone. */
export function formatGameDateTime(
  iso: string | null | undefined,
  timeZone: string | null | undefined
): string {
  if (!iso) return 'Time TBD'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Time TBD'
  const tz = timeZone?.trim() || 'America/Vancouver'
  try {
    return d.toLocaleString(undefined, {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
}
