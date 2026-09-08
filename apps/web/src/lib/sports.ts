/**
 * Canonical sport display names. One source of truth so the Matches switcher,
 * Portfolio breakdowns, and any future surface all call a sport the same
 * thing ("Soccer", never "Football" on one tab and "Soccer" on another).
 */
export const SPORT_LABELS = {
  football: "Soccer",
  mlb: "MLB",
  nfl: "NFL",
  cfb: "CFB",
  nhl: "NHL",
  nba: "NBA",
} as const;

export type SportKey = keyof typeof SPORT_LABELS;
