import { createHmac, timingSafeEqual } from 'node:crypto'

export type FanAlertUnsubscribeScope = 'registration_opens' | 'dropin_reminder'

function secret(): string {
  const s =
    process.env.FAN_ALERT_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.GAME_REMINDER_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  if (!s) {
    throw new Error(
      'FAN_ALERT_UNSUBSCRIBE_SECRET, GAME_REMINDER_UNSUBSCRIBE_SECRET, or CRON_SECRET is required for unsubscribe links'
    )
  }
  return s
}

function signPayload(payload: string): string {
  return createHmac('sha256', secret()).update(payload, 'utf8').digest('base64url')
}

/** Opaque token: `{scope}:{entityUuid}.{hmac}` */
export function createFanAlertUnsubscribeToken(
  scope: FanAlertUnsubscribeScope,
  entityId: string
): string {
  const id = entityId.trim()
  if (!id) throw new Error('entityId required')
  const payload = `${scope}:${id}`
  return `${payload}.${signPayload(payload)}`
}

export function verifyFanAlertUnsubscribeToken(
  token: string
): { scope: FanAlertUnsubscribeScope; entityId: string } | null {
  const raw = token.trim()
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!payload || !sig) return null

  const colon = payload.indexOf(':')
  if (colon <= 0) return null
  const scope = payload.slice(0, colon) as FanAlertUnsubscribeScope
  if (scope !== 'registration_opens' && scope !== 'dropin_reminder') return null
  const entityId = payload.slice(colon + 1)
  if (!entityId) return null

  try {
    const expected = signPayload(payload)
    if (sig.length !== expected.length) return null
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    return { scope, entityId }
  } catch {
    return null
  }
}
