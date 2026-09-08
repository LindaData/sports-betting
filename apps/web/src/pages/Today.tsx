import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import { ArrowRight, PenLine } from "lucide-react";
import { useData } from "@/context/DataContext";
import { LiveScoreCard } from "@/components/LiveScoreCard";
import { PreliminaryChip } from "@/components/PreliminaryChip";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { StatusChip } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonTimeout } from "@/hooks/use-skeleton-timeout";
import { BETTING_DESK_ENABLED } from "@/lib/flags";
import { formatMoney } from "@/lib/edgeMath";
import { espnScheduleEvents, mapEspnGames } from "@/lib/espn";
import { SPORT_LABELS } from "@/lib/sports";
import { getPredictions, type ModelPrediction } from "@/lib/modelFeeds";
import {
  SAMPLE_LEDGER_CSV,
  isSampleLedgerCsv,
  isValidWagerInput,
  normalizeWagerStatus,
  parseLedgerOdds,
  parseLedgerProbability,
  summarizeLedger,
  trackWagers,
  type LedgerSummary,
  type WagerInput,
} from "@/lib/betLedger";
import {
  friendlyTeamName,
  isPlaceholderTeam,
  matchVerdict,
  placeholderMatchLabel,
} from "@/lib/matchVerdict";
import type { LiveFeed } from "@/types";

/** Must match the Bankroll page's storage key so both read the same ledger. */
const LEDGER_STORAGE_KEY = "gsp:bankroll-ledger:v1";

const LIVE_FEED_KEYS = [
  "football_live",
  "nba_live",
  "mlb_live",
  "nfl_live",
  "nhl_live",
  "cfb_live",
] as const;

/** How many compact cards "Up next" shows before deferring to Matches. */
const UP_NEXT_LIMIT = 6;

interface FixtureRow {
  game_id: string;
  date_utc: string;
  status: string;
  sport?: string;
  league?: string;
  home_team: string;
  away_team: string;
  home_score?: string | number | null;
  away_score?: string | number | null;
  venue?: string;
}

export default function Today() {
  const { results, loading } = useData();

  // Coarse clock for the relative kickoff copy; ticks once a minute
  // (information update, not decoration, so no reduced-motion concern).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // One cross-sport fixture pool: soccer fixtures plus every ESPN schedule
  // feed, so the featured card and "Up next" surface whichever league
  // actually plays next — an MLB pennant-race game tonight, NFL week 1, a
  // Saturday CFB slate — instead of a single sport.
  const fixtures = useMemo(
    () =>
      asFixtures([
        ...(Array.isArray(results.football_fixtures?.data)
          ? (results.football_fixtures.data as unknown[])
          : []),
        ...espnScheduleEvents(results),
      ]),
    [results],
  );
  const { map: predictions, preliminary: predictionsPreliminary } = useMemo(
    () => getPredictions(results),
    [results],
  );

  const liveEvents = useMemo(
    () =>
      LIVE_FEED_KEYS.flatMap((key) =>
        (((results[key]?.data as LiveFeed | null)?.events) ?? []).filter(
          (event) => event.state === "in",
        ),
      ),
    [results],
  );

  const todayKey = localDateKey(now);
  const upcoming = useMemo(
    () =>
      fixtures
        .filter((f) => new Date(f.date_utc).getTime() > now.getTime())
        .sort((a, b) => new Date(a.date_utc).getTime() - new Date(b.date_utc).getTime()),
    [fixtures, now],
  );
  // The featured card only fronts a real matchup — a TBD bracket slot never
  // gets the hero treatment, it waits in "Up next" with teaching copy.
  const nextMatch = useMemo(
    () =>
      upcoming.find(
        (f) => !isPlaceholderTeam(f.home_team) && !isPlaceholderTeam(f.away_team),
      ) ?? null,
    [upcoming],
  );
  const upNext = useMemo(
    () => upcoming.filter((f) => f !== nextMatch).slice(0, UP_NEXT_LIMIT),
    [upcoming, nextMatch],
  );

  const ledger = useMemo(() => readLedgerSummary(todayKey), [todayKey]);

  // Skeletons are time-boxed (~3s): if feeds are still unresolved after that,
  // the page renders its taught empty states instead of placeholders forever.
  const skeletonExpired = useSkeletonTimeout();
  const booting = loading && Object.keys(results).length === 0 && !skeletonExpired;
  if (booting) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // One DEMO rule everywhere: a single page-level chip when everything on the
  // page is demo data, card/section-level chips only otherwise — never both
  // in the same viewport.
  const fixturesDemo = results.football_fixtures?.origin === "demo";
  const ledgerDemo = !BETTING_DESK_ENABLED || !ledger || ledger.isSample;
  const pageDemo = fixturesDemo && ledgerDemo;

  return (
    <div className="space-y-6 pb-36 lg:pb-4">
      <header>
        <p className="label-mono">{formatHeaderDate(now)}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="text-xl font-bold">Today</h1>
          {pageDemo && <StatusChip tone="muted" label="Demo" />}
        </div>
      </header>

      {BETTING_DESK_ENABLED ? (
        <BankrollHero ledger={ledger} showDemoChip={!pageDemo} />
      ) : (
        <LeaguePulseHero results={results} now={now} />
      )}

      <NextMatchCard
        fixture={nextMatch}
        prediction={nextMatch ? predictions[nextMatch.game_id] ?? null : null}
        preliminary={predictionsPreliminary}
        demoChip={fixturesDemo && !pageDemo}
        now={now}
      />

      {liveEvents.length > 0 && (
        <Section label="Live now">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveEvents.map((event) => (
              <Link key={event.event_id} to={`/match/${event.event_id}`} className="block">
                <LiveScoreCard
                  event={event}
                  prediction={predictions[event.event_id]}
                  preliminary={predictionsPreliminary}
                />
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section
        label="Up next"
        chip={
          <>
            {fixturesDemo && !pageDemo && <StatusChip tone="muted" label="Demo" />}
            {predictionsPreliminary && upNext.length > 0 && <PreliminaryChip />}
          </>
        }
      >
        {upNext.length > 0 ? (
          // Three-across on desktop so a 3-card slate fills one row instead
          // of wrapping 2+1 with an orphan.
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upNext.map((fixture) => (
              <UpNextCard
                key={fixture.game_id}
                fixture={fixture}
                prediction={predictions[fixture.game_id] ?? null}
                now={now}
              />
            ))}
          </div>
        ) : upcoming.length > 0 ? (
          <EmptyState
            title="That's the whole slate."
            body="Every remaining fixture is above — new matches appear here the moment the schedule publishes."
            link={{ to: "/matches", label: "Browse all matches" }}
          />
        ) : (
          <EmptyState
            title="No matches scheduled yet."
            body="Once the fixture feed publishes, each upcoming match shows up here with kickoff time and the model's win chances."
            link={
              // Feed status is an ops tool — public builds point at Research.
              BETTING_DESK_ENABLED
                ? { to: "/status", label: "Check feed status" }
                : { to: "/research", label: "See how the model works" }
            }
          />
        )}
      </Section>

      {/* The primary slot does real work instead of duplicating the Portfolio
          tab: it deep-links straight into the ledger editor. In-flow on
          desktop, bottom-anchored above the tab bar on mobile. */}
      {BETTING_DESK_ENABLED ? (
        <>
          <div className="hidden pt-1 lg:block">
            <PrimaryAction to="/bankroll?log=1" label="Log today's bet" icon="pen" />
          </div>
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
            <PrimaryAction to="/bankroll?log=1" label="Log today's bet" icon="pen" fullWidth />
          </div>
        </>
      ) : (
        <div className="pt-1">
          <PrimaryAction to="/matches" label="See all matches" icon="arrow" />
        </div>
      )}
    </div>
  );
}

function PrimaryAction({
  to,
  label,
  icon,
  fullWidth = false,
}: {
  to: string;
  label: string;
  icon: "pen" | "arrow";
  fullWidth?: boolean;
}) {
  const Icon = icon === "pen" ? PenLine : ArrowRight;
  return (
    <Link
      to={to}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 font-semibold text-primary-foreground transition-opacity hover:opacity-90 ${
        fullWidth ? "" : "sm:w-auto sm:max-w-xs"
      }`}
    >
      {label}
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

/* ------------------------------ hero blocks ------------------------------ */

function BankrollHero({
  ledger,
  showDemoChip = true,
}: {
  ledger: { summary: LedgerSummary; todayProfit: number; isSample: boolean } | null;
  /** False when a page-level Demo chip already scopes this card. */
  showDemoChip?: boolean;
}) {
  if (!ledger) {
    // Teaching empty state that previews the real thing: a properly styled
    // $0.00 hero, never a bare dash that reads as a rendering failure.
    return (
      <section className="surface-card p-5">
        <p className="label-mono">Bankroll</p>
        <p className="num-hero mt-1 text-muted-foreground">{formatMoney(0)}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Log your first bet in Portfolio and your bankroll — with today's profit or loss — shows
          up here.
        </p>
      </section>
    );
  }

  const { summary, todayProfit, isSample } = ledger;
  const deltaClass =
    todayProfit > 0 ? "text-gain" : todayProfit < 0 ? "text-loss" : "text-muted-foreground";
  const deltaText =
    todayProfit === 0
      ? "No bets settled today"
      : `${todayProfit > 0 ? "+" : ""}${formatMoney(todayProfit)} today`;

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2">
        <p className="label-mono">Bankroll</p>
        {isSample && showDemoChip && <StatusChip tone="muted" label="Demo" />}
      </div>
      <p className="num-hero mt-1">{formatMoney(summary.currentBankroll)}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${deltaClass}`}>{deltaText}</p>
      {summary.openRows > 0 && (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {summary.openRows} open bet{summary.openRows === 1 ? "" : "s"} ·{" "}
          {formatMoney(summary.openExposure)} at risk
        </p>
      )}
    </section>
  );
}

/**
 * The shop window: a one-glance pulse of every league the app covers — live
 * counts, tonight's slate size, or the next scheduled date — each row
 * deep-linking into that sport's tab. An out-of-season league says so in
 * plain words instead of looking broken.
 */
function LeaguePulseHero({
  results,
  now,
}: {
  results: Record<string, { data?: unknown; origin?: string; error?: string } | undefined>;
  now: Date;
}) {
  const todayKey = localDateKey(now);
  const leagues = (["mlb", "nfl", "cfb", "nhl", "nba"] as const).map((key) => {
    const schedule = results[`${key}_schedule`];
    const games = mapEspnGames(schedule?.data ?? null);
    const liveCount = (((results[`${key}_live`]?.data as LiveFeed | null)?.events) ?? []).filter(
      (event) => event.state === "in",
    ).length;
    const todayCount = games.filter(
      (g) => localDateKey(new Date(g.date_utc)) === todayKey,
    ).length;
    const next = games
      .filter((g) => new Date(g.date_utc).getTime() > now.getTime())
      .sort((a, b) => new Date(a.date_utc).getTime() - new Date(b.date_utc).getTime())[0];

    let line: string;
    let emphasis = false;
    if (liveCount > 0) {
      line = `${liveCount} live now`;
      emphasis = true;
    } else if (todayCount > 0) {
      line = `${todayCount} game${todayCount === 1 ? "" : "s"} today`;
      emphasis = true;
    } else if (next) {
      line = `Next game ${formatShortDate(new Date(next.date_utc))}`;
    } else if (schedule?.origin === "empty") {
      line = "Schedule unavailable";
    } else {
      line = "Offseason";
    }
    return { key, label: SPORT_LABELS[key], line, emphasis };
  });

  return (
    <section className="surface-card p-5">
      <p className="label-mono">Across the leagues</p>
      <h2 className="mt-0.5 text-lg font-bold text-card-foreground">
        What's on in sports right now
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {leagues.map((league) => (
          <li key={league.key}>
            <Link
              to={`/matches?sport=${league.key}`}
              className="flex min-h-11 items-center justify-between gap-3 py-2 transition-colors hover:text-foreground"
            >
              <span className="text-sm font-semibold text-card-foreground">{league.label}</span>
              <span
                className={
                  league.emphasis
                    ? "text-sm font-semibold tabular-nums text-card-foreground"
                    : "text-sm tabular-nums text-muted-foreground"
                }
              >
                {league.line}
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            to="/matches"
            className="flex min-h-11 items-center justify-between gap-3 py-2 transition-colors hover:text-foreground"
          >
            <span className="text-sm font-semibold text-card-foreground">
              {SPORT_LABELS.football}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              World Cup 2026 archive
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------ match cards ------------------------------ */

/** The featured fixture: big names, plain-words kickoff, full probability bar. */
function NextMatchCard({
  fixture,
  prediction,
  preliminary,
  demoChip,
  now,
}: {
  fixture: FixtureRow | null;
  prediction: ModelPrediction | null;
  preliminary: boolean;
  demoChip: boolean;
  now: Date;
}) {
  if (!fixture) {
    return (
      <section className="surface-card p-5">
        <p className="label-mono">Next match</p>
        <p className="num-hero mt-1 text-muted-foreground">—</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          When fixtures publish, the next kickoff lives here with the model's win chances for both
          teams.
        </p>
      </section>
    );
  }

  const kickoff = new Date(fixture.date_utc);
  const homeName = friendlyTeamName(fixture.home_team);
  const awayName = friendlyTeamName(fixture.away_team);
  const verdict = prediction
    ? matchVerdict({
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        probs: prediction,
      })
    : null;

  return (
    <Link
      to={`/match/${fixture.game_id}`}
      className="surface-card block p-5 transition-colors hover:border-muted-foreground/50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="label-mono">Next match</p>
          {demoChip && <StatusChip tone="muted" label="Demo" />}
        </div>
        <p className="label-mono tabular-nums">in {formatCountdown(kickoff, now)}</p>
      </div>

      <p className="mt-2 text-2xl font-extrabold leading-tight text-card-foreground">
        {homeName} <span className="text-lg font-normal text-muted-foreground">vs</span> {awayName}
      </p>
      {/* One kickoff line: relative words plus the calendar date in parens
          (the corner countdown already anchors urgency — no repeats). */}
      <p className="mt-1 text-sm font-medium text-foreground">
        {formatRelativeKickoff(kickoff, now)}
        {daysUntilLocal(kickoff, now) < 7 && (
          <span className="font-normal text-muted-foreground"> ({formatShortDate(kickoff)})</span>
        )}
      </p>
      {(fixtureLeagueLabel(fixture) || fixture.venue) && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[fixtureLeagueLabel(fixture), fixture.venue].filter(Boolean).join(" · ")}
        </p>
      )}

      {prediction ? (
        <div className="mt-4 space-y-2">
          <ProbabilityBar probs={prediction} labels={{ home: homeName, away: awayName }} />
          <div className="flex flex-wrap items-center gap-2">
            {verdict && <p className="text-sm text-muted-foreground">{verdict.text}</p>}
            {preliminary && <PreliminaryChip />}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          No model forecast for this matchup yet.
        </p>
      )}
    </Link>
  );
}

/** Compact upcoming row: matchup + kickoff left, the model's pick right. */
function UpNextCard({
  fixture,
  prediction,
  now,
}: {
  fixture: FixtureRow;
  prediction: ModelPrediction | null;
  now: Date;
}) {
  const kickoff = new Date(fixture.date_utc);
  // Bracket placeholders ("Loser SF1") get a human title and friendly names
  // so a TBD third-place match never reads as broken data.
  const bracketLabel = placeholderMatchLabel(fixture.home_team, fixture.away_team);
  const homeName = friendlyTeamName(fixture.home_team);
  const awayName = friendlyTeamName(fixture.away_team);
  // Teams-TBD fixtures never quote a hard percentage — a concrete 44% for
  // teams that don't exist yet is false precision, not honesty.
  const teamsTbd =
    isPlaceholderTeam(fixture.home_team) || isPlaceholderTeam(fixture.away_team);
  const pick = !teamsTbd && prediction ? topPick(prediction, homeName, awayName) : null;
  const meta = [
    formatRelativeKickoff(kickoff, now),
    teamsTbd ? "Teams decided after the semi-finals" : fixtureLeagueLabel(fixture),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to={`/match/${fixture.game_id}`}
      className="surface-card flex items-center justify-between gap-3 p-4 transition-colors hover:border-muted-foreground/50"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-card-foreground">
          {bracketLabel ?? (
            <>
              {homeName} <span className="font-normal text-muted-foreground">vs</span> {awayName}
            </>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {pick ? (
        // Verdict-copy pattern: neutral words carry the pick, green marks the
        // number only — green means "model's number", never a side.
        <div className="shrink-0 text-right">
          <p className="label-mono">Model favors</p>
          <p className="text-sm font-semibold text-card-foreground">
            {pick.name} ·{" "}
            <span className="text-xl font-extrabold tabular-nums text-gain">{pick.pct}%</span>
          </p>
        </div>
      ) : (
        <p className="label-mono shrink-0">{teamsTbd ? "TBD" : "—"}</p>
      )}
    </Link>
  );
}

/* ------------------------------ scaffolding ------------------------------ */

function Section({
  label,
  chip,
  children,
}: {
  label: string;
  chip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h2 className="label-mono">{label}</h2>
        {chip}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm font-medium text-card-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {link && (
        <Link
          to={link.to}
          className="mt-2 inline-block text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */

/** Short league tag for mixed-sport lists: "MLB", "NFL", or the soccer league name. */
function fixtureLeagueLabel(fixture: FixtureRow): string | null {
  if (fixture.sport && fixture.sport in SPORT_LABELS) {
    return SPORT_LABELS[fixture.sport as keyof typeof SPORT_LABELS];
  }
  return fixture.league || null;
}

function asFixtures(data: unknown): FixtureRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is FixtureRow =>
      !!row &&
      typeof row === "object" &&
      typeof (row as FixtureRow).game_id === "string" &&
      typeof (row as FixtureRow).date_utc === "string" &&
      typeof (row as FixtureRow).home_team === "string" &&
      typeof (row as FixtureRow).away_team === "string",
  );
}

/** The model's most likely result for a compact card: name + rounded percent. */
function topPick(
  prediction: ModelPrediction,
  homeName: string,
  awayName: string,
): { name: string; pct: number } | null {
  const home = Math.max(prediction.home || 0, 0);
  const draw = Math.max(prediction.draw || 0, 0);
  const away = Math.max(prediction.away || 0, 0);
  const total = home + draw + away;
  if (total <= 0) return null;
  const pick: "home" | "draw" | "away" =
    home >= draw && home >= away ? "home" : away >= draw ? "away" : "draw";
  const value = pick === "home" ? home : pick === "away" ? away : draw;
  return {
    name: pick === "draw" ? "Draw" : pick === "home" ? homeName : awayName,
    pct: Math.round((value / total) * 100),
  };
}

function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatHeaderDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Short calendar date for the kickoff parenthetical: "Tue, Jul 14". */
function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatKickoff(d: Date, withDay: boolean): string {
  return new Intl.DateTimeFormat(
    undefined,
    withDay
      ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { hour: "numeric", minute: "2-digit" },
  ).format(d);
}

/** Whole local calendar days between now and a target date (0 = today). */
function daysUntilLocal(target: Date, now: Date): number {
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  return Math.round((startOfTarget - startOfNow) / 86_400_000);
}

/** Plain-words kickoff in the user's local time: "Tomorrow, 3:00 PM". */
function formatRelativeKickoff(d: Date, now: Date): string {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  const days = daysUntilLocal(d, now);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days > 1 && days < 7) {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d);
    return `${weekday}, ${time}`;
  }
  return formatKickoff(d, true);
}

function formatCountdown(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "moments";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

/**
 * Reads the bet ledger the Bankroll page persists to localStorage and folds
 * it into a summary plus today's settled profit.
 *
 * First run tells the same story as the Bankroll page: when nothing has been
 * saved yet, this falls back to the same bundled sample ledger Bankroll
 * previews (chipped "Demo"), so Today and Portfolio never contradict each
 * other. Returns null only when the user has explicitly cleared their ledger.
 */
function readLedgerSummary(
  todayKey: string,
): { summary: LedgerSummary; todayProfit: number; isSample: boolean } | null {
  if (typeof window === "undefined") return null;
  let stored: { startingBankroll?: unknown; csvText?: unknown } | null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    stored = JSON.parse(raw ?? "null");
  } catch {
    stored = null;
  }
  if (raw == null || !stored || typeof stored.csvText !== "string") {
    // Nothing saved: preview the same demo ledger the Bankroll page shows.
    stored = { startingBankroll: "1000", csvText: SAMPLE_LEDGER_CSV };
  }
  if (typeof stored.csvText !== "string" || !stored.csvText.trim()) return null;

  const parsed = Papa.parse<Record<string, string>>(stored.csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });
  const rows = parsed.data.map(csvRecordToWager).filter(isValidWagerInput);
  const wagers = trackWagers(rows);
  const startingBankroll = Number(stored.startingBankroll);
  const summary = summarizeLedger(wagers, Number.isFinite(startingBankroll) ? startingBankroll : 0);
  const todayProfit = wagers
    .filter((wager) => wager.isSettled && wager.date === todayKey)
    .reduce((sum, wager) => sum + wager.profit, 0);
  return { summary, todayProfit, isSample: isSampleLedgerCsv(stored.csvText) };
}

/** Same column aliases the Bankroll page accepts, so both read one ledger. */
function csvRecordToWager(record: Record<string, string>): WagerInput {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return "";
  };
  const closingRaw = pick("closing_odds", "closing_price", "close", "close_odds");
  const closingOdds = closingRaw ? parseLedgerOdds(closingRaw) : NaN;
  return {
    date: pick("date", "event_date", "settled_at"),
    sport: pick("sport", "league"),
    selection: pick("selection", "pick", "team", "name"),
    market: pick("market", "bet_type", "type") || "Moneyline",
    americanOdds: parseLedgerOdds(pick("american_odds", "odds", "price", "line")),
    stake: Number(pick("stake", "risk", "amount") || "0"),
    status: normalizeWagerStatus(pick("status", "result", "outcome", "grade")),
    modelProbability: parseLedgerProbability(
      pick("model_probability", "model_probability_pct", "probability", "prob", "win_probability"),
    ),
    closingOdds: Number.isFinite(closingOdds) && closingOdds !== 0 ? closingOdds : null,
    book: pick("book", "sportsbook", "bookmaker"),
    notes: pick("notes", "note", "reason"),
  };
}
