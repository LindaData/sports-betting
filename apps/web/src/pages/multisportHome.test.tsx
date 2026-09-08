import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const feed = (name: string) => {
  const data = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../docs/sports-data/data", name),
      "utf8",
    ),
  );
  return { key: name, data, rows: 1, origin: "network", fetchedAt: "", url: "" };
};

// Public-build flag state: desk private, all sports on.
vi.mock("@/lib/flags", () => ({
  BETTING_DESK_ENABLED: false,
  EXTRA_SPORTS_ENABLED: true,
}));

vi.mock("@/context/DataContext", () => ({
  useData: () => ({
    results: {
      football_fixtures: feed("football_fixtures.json"),
      football_live: feed("football_live.json"),
      mlb_schedule: feed("mlb_schedule.json"),
      nfl_schedule: feed("nfl_schedule.json"),
      cfb_schedule: feed("cfb_schedule.json"),
      nhl_schedule: feed("nhl_schedule.json"),
      nba_schedule: feed("nba_schedule.json"),
      nfl_live: feed("nfl_live.json"),
      mlb_live: feed("mlb_live.json"),
      model_predictions: feed("model_predictions.json"),
    },
    loading: false,
    lastRefresh: null,
  }),
}));

import Today from "@/pages/Today";
import Matches from "@/pages/Matches";

describe("smoke", () => {
  it("renders Today with the league pulse and a cross-sport next match", async () => {
    render(
      <MemoryRouter>
        <Today />
      </MemoryRouter>,
    );
    expect(screen.getByText("What's on in sports right now")).toBeTruthy();
    expect(screen.getByText("World Cup 2026 archive")).toBeTruthy();
    expect(screen.getByText("Next match")).toBeTruthy();
    expect(screen.getAllByText(/game(s)? today|live now|Next game|Offseason/).length).toBeGreaterThan(2);
  });

  it("renders the Matches switcher with all six sports", async () => {
    render(
      <MemoryRouter>
        <Matches />
      </MemoryRouter>,
    );
    for (const label of ["Soccer", "MLB", "NFL", "CFB", "NHL", "NBA"]) {
      expect(await screen.findByRole("button", { name: label })).toBeTruthy();
    }
  });
});
