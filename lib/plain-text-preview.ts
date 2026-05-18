/** Strip simple HTML and collapse whitespace for email preview lines. */
export function plainTextPreview(raw: string, maxLen = 220): string {
  const text = String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`
}
