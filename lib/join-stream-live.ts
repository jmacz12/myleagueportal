/** Payload from `GET /api/join/[slug]/stream` — `live` object. */

export type JoinStreamLivePayload = {
  gameId: string
  streamPageUrl: string | null
  homeName: string | null
  awayName: string | null
  homeScore: number | null
  awayScore: number | null
  period: number | null
  gameClock: string | null
  location: string | null
}

export function parseJoinStreamLivePayload(live: unknown): JoinStreamLivePayload | null {
  if (!live || typeof live !== 'object') return null
  const o = live as Record<string, unknown>
  if (typeof o.gameId !== 'string') return null
  return {
    gameId: o.gameId,
    streamPageUrl: typeof o.streamPageUrl === 'string' ? o.streamPageUrl : null,
    homeName: typeof o.homeName === 'string' ? o.homeName : null,
    awayName: typeof o.awayName === 'string' ? o.awayName : null,
    homeScore: typeof o.homeScore === 'number' ? o.homeScore : null,
    awayScore: typeof o.awayScore === 'number' ? o.awayScore : null,
    period: typeof o.period === 'number' ? o.period : null,
    gameClock: typeof o.gameClock === 'string' ? o.gameClock : null,
    location: typeof o.location === 'string' && o.location.trim() ? o.location.trim() : null,
  }
}
