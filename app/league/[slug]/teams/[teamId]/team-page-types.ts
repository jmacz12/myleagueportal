export interface PlayerTotalsRow {
  min: number
  pts: number
  fg2m: number
  fg3m: number
  ftm: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
}

export interface LastGameView {
  scheduled_at: string | null
  opponent_name: string
  team_points: number
  opp_points: number
  won: boolean
  location?: string | null
}

export interface NextGameView {
  scheduled_at: string | null
  opponent_name: string
  location: string | null
}

export interface TeamNewsItem {
  id: string
  title: string
  body: string
  pinned: boolean
  created_at: string
}

export interface TeamCalendarItem {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  notes: string | null
}

export interface TeamPayload {
  organization: {
    name: string
    slug: string
    primary_color: string | null
    logo_url: string | null
    league_theme_preset?: string | null
    league_appearance_mode?: string | null
    plan?: string | null
  }
  public_tier?: 'basic' | 'pro' | 'enterprise'
  /** Five stat keys for Pro public roster/Stats (same as stream box score). */
  public_primary_stat_keys?: string[]
  team: {
    id: string
    name: string
    color: string | null
    logo_url?: string | null
    season_name: string
    stream_url?: string | null
    house_rules?: string | null
  }
  roster: {
    id: string
    full_name: string
    jersey_number: number | null
    position_label: string | null
    avatar_url?: string | null
  }[]
  open_jersey_poll_id: string | null
  /** When a poll is open (Pro+): signed-in viewer and optional matched roster player + saved pick. */
  jersey_poll_self?: {
    authenticated: boolean
    player_id: string | null
    preferred_number: number | null
  } | null
  publicFontKey: string | null
  season_record?: { wins: number; losses: number }
  league_rank?: number | null
  league_team_count?: number
  player_totals?: Record<string, PlayerTotalsRow> | null
  last_game?: LastGameView | null
  recent_games?: LastGameView[] | null
  next_game?: NextGameView | null
  leader_badges?: Record<string, Partial<Record<keyof PlayerTotalsRow, true>>> | null
  team_news?: TeamNewsItem[]
  league_news?: TeamNewsItem[]
  team_calendar_upcoming?: TeamCalendarItem[]
  /** Present when this team has a season game with status `live` — drives on-site stream overlay */
  live_game_id?: string | null
}

export type PublicTeamTab = 'overview' | 'stream' | 'news' | 'schedule' | 'roster' | 'stats'
