import type { CSSProperties } from 'react'

/** Matches `LeagueSiteSectionBlock` creative headings (public league page). */
export function leagueSiteCreativeHeadingTypography(
  posterLayout: boolean,
  headingFontFamily?: string
): Pick<CSSProperties, 'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing'> {
  return {
    fontFamily: headingFontFamily,
    fontSize: posterLayout ? 'clamp(22px, 2.8vw, 28px)' : 'clamp(20px, 2.5vw, 24px)',
    fontWeight: posterLayout ? 800 : 900,
    letterSpacing: posterLayout ? '-0.01em' : '-0.02em',
  }
}

/** Matches creative block body copy on the public league page. */
export function leagueSiteCreativeBodyTypography(): Pick<CSSProperties, 'fontSize' | 'lineHeight' | 'whiteSpace'> {
  return { fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }
}
