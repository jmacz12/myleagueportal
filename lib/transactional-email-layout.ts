export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildTransactionalEmailHtml(params: {
  preheader: string
  headerBandLabel: string
  headerTitle: string
  bodyHtml: string
  footerHtml: string
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.headerTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(params.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffef9;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 22px 8px;background:#5a7a2a;color:#fff;">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9;">${escapeHtml(params.headerBandLabel)}</p>
              <p style="margin:6px 0 0;font-size:20px;font-weight:700;line-height:1.25;">${escapeHtml(params.headerTitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 22px;color:#1a1a1a;font-size:15px;line-height:1.55;">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 22px 18px;border-top:1px solid #ebe6dc;font-size:12px;line-height:1.5;color:#777;">
              ${params.footerHtml}
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#999;">MyLeaguePortal</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}
