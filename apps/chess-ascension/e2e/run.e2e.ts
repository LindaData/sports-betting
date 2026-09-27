/**
 * End-to-end test: drives the production build in headless Chromium and plays real games through the UI.
 * The "player" picks moves with the game's own engine (reading the board's data-fen), then clicks squares.
 * Run with: npm run e2e
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { Position } from '../src/engine/position';
import { F_CAPTURE, PAWN, parseSquare, squareName, typeOf } from '../src/engine/constants';
import { compileRules, type OwnedReinforcement } from '../src/game/reinforcements';
import { findBestMove } from '../src/ai/search';

const PORT = 4391;
const URL = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);

let server: ChildProcess;
let browser: Browser;
let page: Page;
const pageErrors: string[] = [];

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

beforeAll(async () => {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ executablePath: CHROME });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
});

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

const storage = async <T>(key: string): Promise<T | null> =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);

async function owned(): Promise<OwnedReinforcement[]> {
  const run = await storage<{ reinforcements: OwnedReinforcement[] }>('chess-ascension:run:v1');
  return run?.reinforcements ?? [];
}

/** Wait until it is the player's turn (or the game is over). */
async function waitForPlayer(): Promise<'turn' | 'over'> {
  await page.waitForFunction(
    () =>
      !!document.querySelector('.result-overlay') ||
      (document.querySelector('.board')?.getAttribute('data-turn') === 'w' && !document.querySelector('.spinner')),
    undefined,
    { timeout: 30_000 },
  );
  return (await page.$('.result-overlay')) ? 'over' : 'turn';
}

async function clickMove(from: string, to: string) {
  try {
    await page.click(`[data-square="${from}"]`, { timeout: 8000 });
    await page.click(`[data-square="${to}"]`, { timeout: 8000 });
  } catch (e) {
    const status = await page.textContent('.ghead__status').catch(() => '?');
    const fen = await page.getAttribute('.board', 'data-fen').catch(() => '?');
    if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/failure.png` });
    throw new Error(`could not play ${from}${to} (status "${status}", fen ${fen})`, { cause: e });
  }
  if (await page.$('.promo')) await page.click('[data-promo="Queen"]');
}

async function currentPosition(): Promise<Position> {
  const fen = (await page.getAttribute('.board', 'data-fen'))!;
  return new Position(compileRules(await owned()), fen);
}

const uci = (m: { from: number; to: number }) => [squareName(m.from), squareName(m.to)] as const;

/** Resolve a pending bonus move by clicking the first highlighted target (exercises the bonus UI). */
async function playBonusIfAny(): Promise<boolean> {
  if (!(await page.$('.bonusbar'))) return false;
  const target = await page.$('.sq--target');
  if (target) await target.click();
  else await page.click('text=Skip bonus');
  // a bonus pawn move can reach the last rank and open the promotion picker
  if (await page.$('.promo')) await page.click('[data-promo="Queen"]');
  return true;
}

interface PlayOptions {
  preferPawnCapture?: boolean;
  onBonus?: (text: string) => void;
  maxMoves?: number;
}

/** Play the current game to completion. Returns the result title. */
async function playOut(opts: PlayOptions = {}): Promise<string> {
  for (let i = 0; i < (opts.maxMoves ?? 160); i++) {
    if ((await waitForPlayer()) === 'over') break;
    if (await page.$('.bonusbar')) {
      opts.onBonus?.((await page.textContent('.bonusbar')) ?? '');
      await playBonusIfAny();
      continue;
    }
    const pos = await currentPosition();
    let move = null;
    if (opts.preferPawnCapture) {
      move = pos.legalMoves().find((m) => typeOf(m.piece) === PAWN && m.flags & F_CAPTURE) ?? null;
    }
    move ??= findBestMove(pos, { depth: 3, timeMs: 350, noise: 0, blunder: 0, blunderMargin: 0 }).move;
    expect(move).not.toBeNull();
    const [from, to] = uci(move!);
    await clickMove(from, to);
  }
  await page.waitForSelector('.result-overlay', { timeout: 30_000 }).catch(() => null);
  return ((await page.textContent('.result__title')) ?? 'none').trim();
}

describe('Chess Ascension end-to-end', () => {
  it('starts a run, plays a full game with castling, wins, drafts a reward and advances', async () => {
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Start Run' }).click();
    await page.waitForSelector('[data-round="1"]');
    const elo1 = Number(await page.getAttribute('[data-computer-elo]', 'data-computer-elo'));
    expect(elo1).toBe(400);
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.waitForSelector('.board');

    // Scripted development toward kingside castling, falling back to engine moves if a step is illegal.
    const plan = [
      ['e2', 'e4'],
      ['g1', 'f3'],
      ['f1', 'c4'],
      ['e1', 'g1'],
    ];
    let castled = false;
    for (const [from, to] of plan) {
      await waitForPlayer();
      const pos = await currentPosition();
      const ok = pos.legalMoves().some((m) => m.from === parseSquare(from) && m.to === parseSquare(to));
      if (ok) {
        await clickMove(from, to);
        if (from === 'e1') castled = true;
      } else {
        const m = findBestMove(pos, { depth: 3, timeMs: 300, noise: 0, blunder: 0, blunderMargin: 0 }).move!;
        await clickMove(...uci(m));
      }
    }
    await waitForPlayer();
    if (castled) {
      const fen = (await page.getAttribute('.board', 'data-fen'))!;
      const rank1 = fen.split(' ')[0].split('/')[7];
      expect(rank1.endsWith('RK1')).toBe(true); // rook f1, king g1
    }
    // the computer has actually been moving
    const blackMoves = await page.$$eval('.movelog__b', (els) => els.filter((e) => e.textContent?.trim()).length);
    expect(blackMoves).toBeGreaterThanOrEqual(3);

    let title = await playOut();
    for (let attempt = 0; title === 'Draw' && attempt < 3; attempt++) {
      await page.click('text=Replay Round');
      await page.getByRole('button', { name: 'Start Game' }).click();
      title = await playOut();
    }
    expect(title).toBe('Victory');
    expect(await page.textContent('.result__reason')).toMatch(/Checkmate/);

    await page.click('text=Claim Reinforcement');
    const cards = await page.$$('[data-reinforcement]');
    expect(cards).toHaveLength(3);
    const ids = await page.$$eval('[data-reinforcement]', (els) => els.map((e) => e.getAttribute('data-reinforcement')));
    expect(new Set(ids).size).toBe(3);
    await cards[0].click();
    await page.click('.reward .btn--primary');
    await page.waitForSelector('[data-round="2"]');
    const elo2 = Number(await page.getAttribute('[data-computer-elo]', 'data-computer-elo'));
    expect(elo2).toBe(500);
    expect((await owned()).map((o) => o.id)).toEqual([ids[0]]);

    const stats = await storage<{ games: number; wins: number; highestElo: number }>('chess-ascension:stats:v1');
    expect(stats?.wins).toBe(1);
    expect(stats?.highestElo).toBe(elo1);
  });

  it('Knight Queen, Pawn Momentum and Twin Strike all work together in the UI', async () => {
    // Load a saved run with several reinforcements, as if the player had reached round 8 (1100 ELO).
    await page.evaluate(() => {
      localStorage.setItem(
        'chess-ascension:run:v1',
        JSON.stringify({
          id: 'e2e',
          round: 8,
          playerElo: 1240,
          eloOffset: 0,
          reinforcements: [
            { id: 'knight-queen', stacks: 1, round: 1 },
            { id: 'pawn-momentum', stacks: 1, round: 2 },
            { id: 'twin-strike', stacks: 1, round: 2 },
            { id: 'second-wind', stacks: 1, round: 2 },
          ],
          phase: 'round',
          offers: [],
          wins: 2,
          draws: 0,
          startedAt: Date.now(),
        }),
      );
    });
    await page.goto(URL);
    await page.getByRole('button', { name: /Continue Run · Round 8/ }).click();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.waitForSelector('.board');
    expect(await page.textContent('.rpanel')).toContain('Knight Queen');

    // Knight Queen: from the starting position the queen on d1 can already jump to c3 and e3.
    await page.click('[data-square="d1"]');
    const special = await page.$$eval('.hint--special', (els) => els.map((e) => e.parentElement?.getAttribute('data-square')).sort());
    expect(special).toEqual(['c3', 'e3']);
    await page.click('[data-square="d1"]'); // deselect

    // Twin Strike: arm, then disarm via the ability button.
    await page.click('.ability:has-text("Twin Strike")');
    expect(await page.textContent('.ability--armed')).toContain('ARMED');
    expect(await page.textContent('.ghead__status')).toContain('Twin Strike armed');
    await page.click('.ability:has-text("Twin Strike")');
    expect(await page.$('.ability--armed')).toBeNull();
    expect(await page.textContent('.abilities')).toContain('Second Wind');

    // Knight Queen jump in a real move.
    await clickMove('d1', 'e3');
    await waitForPlayer();
    const fen = (await page.getAttribute('.board', 'data-fen'))!;
    expect(fen.split(' ')[0].split('/')[5]).toContain('Q'); // queen now on the third rank

    // Pawn Momentum: take pawn captures whenever possible until the bonus move UI appears.
    const bonusTexts: string[] = [];
    await playOut({ preferPawnCapture: true, onBonus: (t) => bonusTexts.push(t), maxMoves: 60 });
    expect(bonusTexts.some((t) => t.includes('Pawn Momentum'))).toBe(true);
  });

  it('losing ends the run, shows the summary, and statistics persist across reloads', async () => {
    // Resolve whatever state the previous test left: finish via resignation if a game is still running.
    if (!(await page.$('.result-overlay'))) {
      await page.click('text=Resign');
      await page.click('text=Yes, resign');
    }
    const title = (await page.textContent('.result__title'))?.trim();
    if (title === 'Defeat') {
      await page.click('text=See Results');
    } else {
      // won or drew the momentum game: move on and resign the next one
      await page.click('.result .btn--primary');
      if (await page.$('[data-reinforcement]')) {
        await page.click('[data-reinforcement]');
        await page.click('.reward .btn--primary');
      }
      await page.getByRole('button', { name: 'Start Game' }).click();
      await page.click('text=Resign');
      await page.click('text=Yes, resign');
      await page.click('text=See Results');
    }
    await page.waitForSelector('.over');
    expect(await page.textContent('.over__title')).toMatch(/Run Over/i);
    const round = Number(await page.getAttribute('[data-over-round]', 'data-over-round'));
    expect(round).toBeGreaterThanOrEqual(8);
    expect(await page.$$('.over__cards .card')).not.toHaveLength(0);

    const stats = await storage<{ runs: number; losses: number; games: number; bestRound: number }>('chess-ascension:stats:v1');
    expect(stats?.runs).toBe(1);
    expect(stats?.losses).toBe(1);
    expect(stats?.bestRound).toBeGreaterThanOrEqual(8);
    expect(await storage('chess-ascension:run:v1')).toBeNull();

    // restart
    await page.getByRole('button', { name: 'Start New Run' }).click();
    await page.waitForSelector('[data-round="1"]');

    // persistence across reload
    await page.reload();
    await page.getByRole('button', { name: /Continue Run · Round 1/ }).waitFor();
    expect(Number(await page.textContent('[data-stat="Runs"]'))).toBe(1);
    expect(Number(await page.textContent('[data-stat="Games"]'))).toBe(stats!.games);
    expect(pageErrors).toEqual([]);
  });

  it('renders cleanly on an iPhone-sized screen', async () => {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mobile.goto(URL);
    await mobile.getByRole('button', { name: /Start Run|Continue Run/ }).click();
    await mobile.getByRole('button', { name: 'Start Game' }).click();
    await mobile.waitForSelector('.board');
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await mobile.$eval('.board', (el) => el.getBoundingClientRect().width);
    expect(box).toBeGreaterThan(340);
    await mobile.tap('[data-square="e2"]');
    await mobile.tap('[data-square="e4"]');
    await mobile.waitForFunction(() => document.querySelector('.board')?.getAttribute('data-turn') === 'w' && !document.querySelector('.spinner'));
    if (process.env.E2E_SCREENSHOTS) await mobile.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/mobile-game.png`, fullPage: true });
    await mobile.close();
  });
});

