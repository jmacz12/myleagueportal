/**
 * League sport templates: drive registration position chips and marketing copy.
 * Stored on `organizations.sport_template_id` (string); invalid / missing → basketball.
 */

export const DEFAULT_SPORT_TEMPLATE_ID = 'basketball'

/** Set on account sign-up (sport step) and read once on `/onboarding` to pre-fill league sport. */
export const MLP_PREF_SPORT_STORAGE_KEY = 'mlp_pref_sport_template_id'

export const SPORT_TEMPLATES = [
  {
    id: 'basketball',
    name: 'Basketball',
    blurb: 'Five traditional spots plus flex roles for rec leagues.',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
  },
  {
    id: 'soccer',
    name: 'Soccer',
    blurb: 'From keeper to striker — pick every role you’re happy to play.',
    positions: ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    blurb: 'Indoor six — setter through libero/defensive specialist.',
    positions: ['S', 'OH', 'MB', 'OPP', 'L', 'DS'],
  },
  {
    id: 'football',
    name: 'Football',
    blurb: 'American football skill groups for roster tags.',
    positions: ['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'],
  },
  {
    id: 'hockey',
    name: 'Hockey',
    blurb: 'Ice or roller — forwards, defense, and goalie.',
    positions: ['C', 'LW', 'RW', 'LD', 'RD', 'G'],
  },
  {
    id: 'baseball',
    name: 'Baseball',
    blurb: 'Nine positions plus pitcher for league rosters.',
    positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  },
  {
    id: 'softball',
    name: 'Softball',
    blurb: 'Same diamond roles as baseball — tuned for fastpitch / slowpitch programs.',
    positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  },
  {
    id: 'tennis',
    name: 'Tennis',
    blurb: 'Singles, doubles, or both — for club leagues and ladders.',
    positions: ['Singles', 'Doubles'],
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    blurb: 'Great for ladders and social nights — no fixed position list.',
    positions: [],
  },
  {
    id: 'lacrosse',
    name: 'Lacrosse',
    blurb: 'Field roles from attack through goalie.',
    positions: ['A', 'M', 'D', 'G'],
  },
  {
    id: 'rugby',
    name: 'Rugby',
    blurb: 'Forward pack and back line — abbreviations organizers know.',
    positions: ['PR', 'HK', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB'],
  },
] as const

export type SportTemplateId = (typeof SPORT_TEMPLATES)[number]['id']

export type SportTemplate = {
  id: SportTemplateId
  name: string
  blurb: string
  positions: readonly string[]
}

const TEMPLATE_BY_ID = new Map<string, SportTemplate>(
  SPORT_TEMPLATES.map((t) => [t.id, t])
)

export function normalizeSportTemplateId(raw: unknown): SportTemplateId {
  const id = typeof raw === 'string' ? raw.trim() : ''
  if (TEMPLATE_BY_ID.has(id)) return id as SportTemplateId
  return DEFAULT_SPORT_TEMPLATE_ID
}

export function sportTemplateById(id: SportTemplateId): SportTemplate {
  return TEMPLATE_BY_ID.get(id) ?? TEMPLATE_BY_ID.get(DEFAULT_SPORT_TEMPLATE_ID)!
}

export function positionsForSportTemplate(id: SportTemplateId): string[] {
  return [...sportTemplateById(id).positions]
}

/**
 * Validates submitted registration positions against the league template.
 * Case-insensitive match; returns canonical labels from the template.
 */
export function normalizeSubmittedPositions(raw: unknown, sportTemplateId: SportTemplateId): string[] {
  const allowed = positionsForSportTemplate(sportTemplateId)
  if (allowed.length === 0) return []
  const upperToCanon = new Map(allowed.map((p) => [p.toUpperCase(), p]))
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    const key = String(x).trim().toUpperCase()
    const canon = upperToCanon.get(key)
    if (canon && !seen.has(canon)) {
      seen.add(canon)
      out.push(canon)
    }
  }
  return out
}

export function sportTemplateChoicesForSelect(): { id: SportTemplateId; name: string }[] {
  return SPORT_TEMPLATES.map(({ id, name }) => ({ id, name }))
}
