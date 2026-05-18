import { createHmac, timingSafeEqual } from 'node:crypto'

function secret(): string {
  const s =
    process.env.GAME_REMINDER_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  if (!s) throw new Error('GAME_REMINDER_UNSUBSCRIBE_SECRET or CRON_SECRET is required for unsubscribe links')
  return s
}

function sign(playerId: string): string {
  return createHmac('sha256', secret()).update(playerId, 'utf8').digest('base64url')
}

/** Opaque token: `{playerUuid}.{hmac}` */
export function createGameReminderUnsubscribeToken(playerId: string): string {
  const id = playerId.trim()
  if (!id) throw new Error('playerId required')
  return `${id}.${sign(id)}`
}

export function verifyGameReminderUnsubscribeToken(token: string): string | null {
  const raw = token.trim()
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const playerId = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!playerId || !sig) return null
  try {
    const expected = sign(playerId)
    if (sig.length !== expected.length) return null
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    return playerId
  } catch {
    return null
  }
}
