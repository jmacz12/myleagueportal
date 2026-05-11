/** Cross-tab sync when league brand/theme or usage counters change (Settings ↔ public edit). */
export const LEAGUE_APPEARANCE_SYNC_CHANNEL = 'mlp-league-appearance-v1'

export function broadcastLeagueAppearanceUpdated(): void {
  if (typeof window === 'undefined') return
  try {
    const bc = new BroadcastChannel(LEAGUE_APPEARANCE_SYNC_CHANNEL)
    bc.postMessage({ type: 'appearance-updated' as const })
    bc.close()
  } catch {
    /* ignore */
  }
}

/** Returns unsubscribe. Safe no-op if BroadcastChannel unavailable. */
export function subscribeLeagueAppearanceUpdated(onUpdate: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  try {
    const bc = new BroadcastChannel(LEAGUE_APPEARANCE_SYNC_CHANNEL)
    bc.onmessage = () => onUpdate()
    return () => {
      try {
        bc.close()
      } catch {
        /* ignore */
      }
    }
  } catch {
    return () => {}
  }
}
