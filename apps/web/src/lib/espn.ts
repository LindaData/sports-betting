import type { GameRow, StandingRow } from "@/types";

// The ESPN multisport feeds (nfl/nba/mlb/nhl/cfb _schedule.json and
// _standings_espn.json, published by scripts/publish_multisport_espn.py) nest
// rows under an {events: [...]} / {standings: [...]} envelope and use
// numeric/null values. GamesView/StandingsView expect the string-valued row
// shapes the CSV feeds produce, so unwrap and normalize here — the same
// pattern lib/football.ts applies to the football JSON.

type JsonRow = Record<string, unknown>;

const s = (v: unknown): string => (v == null ? "" : String(v));

function rowsOf(data: unknown, key: "events" | "standings"): JsonRow[] {
  if (Array.isArray(data)) return data as JsonRow[];
  if (data && typeof data === "object") {
    const nested = (data as JsonRow)[key];
    if (Array.isArray(nested)) return nested as JsonRow[];
  }
  return [];
}

export function mapEspnGames(data: unknown): GameRow[] {
  return rowsOf(data, "events").map((r) => ({
    sport: s(r.sport),
    game_id: s(r.game_id),
    date_utc: s(r.date_utc),
    status: s(r.status),
    league_id: s(r.league_id),
    league: s(r.league),
    season: s(r.season),
    home_team_id: s(r.home_team_id),
    home_team: s(r.home_team),
    away_team_id: s(r.away_team_id),
    away_team: s(r.away_team),
    home_score: s(r.home_score),
    away_score: s(r.away_score),
  }));
}

/** Every ESPN schedule feed the app registers, one key per sport. */
export const ESPN_SCHEDULE_KEYS = [
  "mlb_schedule",
  "nfl_schedule",
  "cfb_schedule",
  "nhl_schedule",
  "nba_schedule",
] as const;

/**
 * Flattens every ESPN schedule feed's events into one raw row list so
 * cross-sport surfaces (Today, MatchDetail) see a single fixture pool
 * alongside the football fixtures.
 */
export function espnScheduleEvents(
  results: Record<string, { data?: unknown } | undefined>,
): JsonRow[] {
  return ESPN_SCHEDULE_KEYS.flatMap((key) =>
    rowsOf(results[key]?.data ?? null, "events"),
  );
}

export function mapEspnStandings(data: unknown): StandingRow[] {
  return rowsOf(data, "standings").map((r) => ({
    sport: s(r.sport),
    position: s(r.position),
    group: s(r.group) || "Overall",
    team_id: s(r.team_id) || s(r.team),
    team: s(r.team),
    played: s(r.played),
    wins: s(r.wins),
    losses: s(r.losses),
    percentage: s(r.percentage),
    form: s(r.form),
  }));
}
