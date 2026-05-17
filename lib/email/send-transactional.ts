export type SendEmailResult =
  | { ok: true; id?: string; skipped?: boolean; reason?: string }
  | { ok: false; error: string }

function emailFromAddress(): string | null {
  const from = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim()
  return from || null
}

/** Send one transactional email via Resend (https://resend.com). */
export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = emailFromAddress()

  if (!apiKey) {
    return { ok: true, skipped: true, reason: 'RESEND_API_KEY not configured' }
  }
  if (!from) {
    return { ok: true, skipped: true, reason: 'RESEND_FROM / EMAIL_FROM not configured' }
  }

  const to = params.to.trim().toLowerCase()
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'Invalid recipient email' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
  if (!res.ok) {
    return { ok: false, error: json?.message || `Resend HTTP ${res.status}` }
  }
  return { ok: true, id: json?.id }
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && emailFromAddress())
}
