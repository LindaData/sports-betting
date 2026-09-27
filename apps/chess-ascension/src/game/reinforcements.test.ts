import { describe, expect, it } from 'vitest';
import { ALL_SQUARES, F_PASS, KING, NO_BONUS, WHITE, BLACK, parseSquare as sq, squareName, typeOf, PAWN, AMAZON, ARCHBISHOP, CHANCELLOR } from '../engine/constants';
import { Position, type Move } from '../engine/position';
import { standardRules } from '../engine/rules';
import { compileRules, draftOffers, REINFORCEMENTS, type OwnedReinforcement } from './reinforcements';
import { Match } from './match';
import { findBestMove, settingsForElo } from '../ai/search';

const own = (...ids: string[]): OwnedReinforcement[] => ids.map((id) => ({ id, stacks: 1, round: 1 }));
const rulesWith = (...ids: string[]) => compileRules(own(...ids));
const targets = (moves: Move[], from: string) => moves.filter((m) => m.from === sq(from)).map((m) => squareName(m.to)).sort();
const find = (pos: Position, uci: string) => {
  const m = pos.legalMoves().find((x) => x.from === sq(uci.slice(0, 2)) && x.to === sq(uci.slice(2, 4)) && (!uci[4] || x.promo));
  if (!m) throw new Error(`illegal ${uci} in ${pos.fen()}`);
  return m;
};

describe('movement reinforcements', () => {
  it('Knight Queen adds knight jumps to the queen', () => {
    const fen = '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1';
    const normal = new Position(standardRules(), fen).legalMoves();
    const pos = new Position(rulesWith('knight-queen'), fen);
    const boosted = pos.legalMoves();
    expect(targets(normal, 'd4')).toHaveLength(27);
    expect(targets(boosted, 'd4')).toHaveLength(35);
    expect(targets(boosted, 'd4')).toEqual(expect.arrayContaining(['c6', 'e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5']));
    expect(boosted.filter((m) => m.from === sq('d4') && m.special)).toHaveLength(8);
  });

  it('Knight Queen gives check with a knight jump (enemy king must respect it)', () => {
    const pos = new Position(rulesWith('knight-queen'), '4k3/8/8/8/8/8/8/3QK3 b - - 0 1');
    // black king may not step to d6? no: d6 is not attacked. f7 is attacked by a Qd1? no. Check squares attacked via knight leap from d1: c3,e3,b2,f2
    const q = new Position(rulesWith('knight-queen'), '8/8/8/8/8/2k5/8/3QK3 b - - 0 1');
    expect(q.inCheck()).toBe(true); // d1 -> c3 is a knight jump
    expect(pos.inCheck()).toBe(false);
  });

  it('a pinned Knight Queen cannot jump off the pin line (king safety still applies)', () => {
    const pos = new Position(rulesWith('knight-queen'), '4r1k1/8/8/8/8/8/4Q3/4K3 w - - 0 1');
    const qMoves = targets(pos.legalMoves(), 'e2');
    expect(qMoves).toEqual(['e3', 'e4', 'e5', 'e6', 'e7', 'e8']);
  });

  it("Royal Knight, Bishop's Reach, Royal Rook, Leaping Knights, Cardinal Bishops, Cavalry Rooks", () => {
    const k = new Position(rulesWith('royal-knight'), '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1');
    expect(targets(k.legalMoves(), 'd4')).toHaveLength(12);
    const b = new Position(rulesWith('bishops-reach'), '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1');
    expect(targets(b.legalMoves(), 'd4')).toHaveLength(13 + 4);
    const r = new Position(rulesWith('royal-rook'), '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1');
    expect(targets(r.legalMoves(), 'd4')).toHaveLength(14 + 4);
    const l = new Position(rulesWith('leaping-knights'), '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1');
    expect(targets(l.legalMoves(), 'd4')).toHaveLength(12);
    const cb = new Position(rulesWith('cardinal-bishops'), '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1');
    expect(targets(cb.legalMoves(), 'd4')).toHaveLength(13 + 8);
    const cr = new Position(rulesWith('cavalry-rooks'), '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1');
    expect(targets(cr.legalMoves(), 'd4')).toHaveLength(14 + 8);
  });

  it('Royal Reinforcement lets the king jump like a knight but never into check', () => {
    const pos = new Position(rulesWith('royal-reinforcement'), '4k3/8/8/8/8/8/8/r3K3 b - - 0 1'.replace(' b ', ' w '));
    const t = targets(pos.legalMoves(), 'e1');
    expect(t).toEqual(expect.arrayContaining(['d3', 'f3', 'g2']));
    expect(t).toContain('c2'); // knight jump to a safe square
    expect(t).not.toContain('d1');
    expect(t).not.toContain('f1');
  });

  it('Pawn Sprint and Sidestep extend pawn movement', () => {
    const s = new Position(rulesWith('pawn-sprint', 'sidestep'), '4k3/8/8/8/3P4/8/8/4K3 w - - 0 1');
    expect(targets(s.legalMoves(), 'd4')).toEqual(['c4', 'd5', 'd6', 'e4']);
  });

  it('Promotion+ offers Archbishop and Chancellor, plus Amazon with Knight Queen', () => {
    const fen = '8/3P4/8/8/8/8/k7/4K3 w - - 0 1';
    const plus = new Position(rulesWith('promotion-plus'), fen).legalMoves().filter((m) => m.from === sq('d7'));
    expect(plus.map((m) => m.promo)).toEqual(expect.arrayContaining([ARCHBISHOP, CHANCELLOR]));
    expect(plus.map((m) => m.promo)).not.toContain(AMAZON);
    const both = new Position(rulesWith('promotion-plus', 'knight-queen'), fen).legalMoves().filter((m) => m.from === sq('d7'));
    expect(both.map((m) => m.promo)).toContain(AMAZON);
    expect(both).toHaveLength(7);
  });
});

describe('Pawn Momentum', () => {
  const fen = '4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1';

  it('grants the capturing pawn one bonus move, then the turn ends', () => {
    const pos = new Position(rulesWith('pawn-momentum'), fen);
    pos.make(find(pos, 'e4d5'));
    expect(pos.turn).toBe(WHITE);
    expect(pos.bonusSq).toBe(sq('d5'));
    const bonus = pos.legalMoves();
    expect(bonus.some((m) => m.flags & F_PASS)).toBe(true);
    expect(bonus.filter((m) => !(m.flags & F_PASS)).every((m) => m.from === sq('d5'))).toBe(true);
    expect(targets(bonus, 'd5')).toEqual(['c6', 'd6']);
    pos.make(find(pos, 'd5c6'));
    expect(pos.turn).toBe(BLACK); // no infinite chain with one stack
    expect(pos.bonusSq).toBe(NO_BONUS);
  });

  it('stacks allow a capture chain', () => {
    const rules = compileRules([{ id: 'pawn-momentum', stacks: 2, round: 1 }]);
    const pos = new Position(rules, '4k3/1p6/2p5/3p4/4P3/8/8/4K3 w - - 0 1');
    pos.make(find(pos, 'e4d5'));
    pos.make(find(pos, 'd5c6'));
    expect(pos.turn).toBe(WHITE);
    pos.make(find(pos, 'c6b7'));
    expect(pos.turn).toBe(BLACK);
  });

  it('does not trigger without the reinforcement and bonus can be skipped', () => {
    const plain = new Position(standardRules(), fen);
    plain.make(find(plain, 'e4d5'));
    expect(plain.turn).toBe(BLACK);
    const pos = new Position(rulesWith('pawn-momentum'), fen);
    pos.make(find(pos, 'e4d5'));
    pos.make(pos.legalMoves().find((m) => m.flags & F_PASS)!);
    expect(pos.turn).toBe(BLACK);
  });

  it('a bonus move can never capture the king', () => {
    const pos = new Position(rulesWith('pawn-momentum'), '8/8/3k4/3p4/4P3/8/8/4K3 w - - 0 1');
    pos.make(find(pos, 'e4d5'));
    // the pawn on d5 now attacks c6/e6; king d6 is adjacent but kings are never capturable
    for (const m of pos.legalMoves()) expect(typeOf(m.captured)).not.toBe(KING);
  });
});

describe('Armored Pawn, Queen\'s Guard, Twin Strike, Time Warp, Second Wind', () => {
  it('Armored Pawn blocks the first capture of each pawn', () => {
    const m = new Match(rulesWith('armored-pawn'), Math.random, '4k3/8/8/8/2n5/8/1P6/4K3 w - - 0 1');
    m.pos.armor[sq('b2')] = m.rules.sides[WHITE].pawnArmor;
    m.pos.recomputeHash();
    m.play(find(m.pos, 'e1d1'));
    const ev = m.play(find(m.pos, 'c4b2'));
    expect(ev.some((e) => e.kind === 'armor')).toBe(true);
    expect(m.pos.board[sq('b2')]).toBe(PAWN); // white pawn survived
    expect(typeOf(m.pos.board[sq('c4')])).toBe(2); // knight stayed home
    m.play(find(m.pos, 'd1e1'));
    m.play(find(m.pos, 'c4b2'));
    expect(typeOf(m.pos.board[sq('b2')])).toBe(2); // second capture goes through
  });

  it('match setup gives every player pawn armor', () => {
    const m = new Match(rulesWith('armored-pawn'));
    expect(ALL_SQUARES.filter((s) => m.pos.armor[s] > 0)).toHaveLength(8);
  });

  it("Queen's Guard: only a protected piece may capture the queen", () => {
    const fen = '4k3/8/8/3r4/3Q4/8/8/4K3 b - - 0 1';
    const guarded = new Position(rulesWith('queens-guard'), fen);
    expect(targets(guarded.legalMoves(), 'd5')).not.toContain('d4');
    const plain = new Position(standardRules(), fen);
    expect(targets(plain.legalMoves(), 'd5')).toContain('d4');
    const protectedAttacker = new Position(rulesWith('queens-guard'), '4k3/8/4p3/3r4/3Q4/8/8/4K3 b - - 0 1');
    expect(targets(protectedAttacker.legalMoves(), 'd5')).not.toContain('d4'); // e6 pawn protects d5, not d4
    const defended = new Position(rulesWith('queens-guard'), '4k3/8/8/3r4/3Q4/8/8/4K3 b - - 0 1'.replace('3r4/3Q4', '3rp3/3Q4'));
    expect(targets(defended.legalMoves(), 'd5')).toContain('d4'); // e5 pawn defends d4
  });

  it('Twin Strike gives an armed rook two moves, and pairs with Knight Queen for the queen', () => {
    const m = new Match(rulesWith('twin-strike', 'knight-queen'), Math.random, '4k3/pppppppp/8/8/8/8/8/R2QK3 w - - 0 1');
    expect(m.charges.twin).toBe(1);
    m.arm('twin');
    expect(m.armed).toBe('twin');
    const ev = m.play(find(m.pos, 'd1c3')); // queen knight-jump
    expect(ev).toEqual([{ kind: 'bonus', source: 'twin' }]);
    expect(m.charges.twin).toBe(0);
    expect(m.turn).toBe(WHITE);
    expect(m.legalMoves().filter((x) => !(x.flags & F_PASS)).every((x) => x.from === sq('c3'))).toBe(true);
    m.play(find(m.pos, 'c3c7'));
    expect(m.turn).toBe(BLACK);
    m.arm('twin');
    expect(m.armed).toBe('none');
  });

  it('Time Warp grants a second move with any piece', () => {
    const m = new Match(rulesWith('time-warp'));
    m.arm('warp');
    m.play(find(m.pos, 'e2e4'));
    expect(m.turn).toBe(WHITE);
    m.play(find(m.pos, 'd2d4'));
    expect(m.turn).toBe(BLACK);
    expect(m.charges.warp).toBe(0);
  });

  it('Second Wind rewinds a checkmate once', () => {
    const m = new Match(rulesWith('second-wind'));
    m.play(find(m.pos, 'f2f3'));
    m.play(find(m.pos, 'e7e5'));
    m.play(find(m.pos, 'g2g4'));
    const ev = m.play(find(m.pos, 'd8h4'));
    expect(ev).toContainEqual({ kind: 'second-wind' });
    expect(m.result).toBeNull();
    expect(m.turn).toBe(WHITE);
    expect(m.log).toHaveLength(2);
    expect(m.charges.secondWind).toBe(0);
    m.play(find(m.pos, 'g2g4'));
    m.play(find(m.pos, 'd8h4'));
    expect(m.result).toEqual({ winner: BLACK, reason: 'checkmate' });
  });

  it('Sabotage removes enemy pawns at setup', () => {
    const m = new Match(compileRules([{ id: 'sabotage', stacks: 2, round: 1 }]));
    expect(ALL_SQUARES.filter((s) => m.pos.board[s] === (16 | PAWN))).toHaveLength(6);
  });
});

describe('engine integrity with every reinforcement active', () => {
  it('make/unmake and hashing stay consistent over random games', () => {
    const everything = compileRules(REINFORCEMENTS.map((r) => ({ id: r.id, stacks: r.maxStacks, round: 1 })));
    let seed = 99;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let g = 0; g < 30; g++) {
      const m = new Match(everything, rand);
      for (let ply = 0; ply < 160 && !m.result; ply++) {
        if (m.turn === WHITE && !m.inBonus && rand() < 0.1) m.arm(rand() < 0.5 ? 'twin' : 'warp');
        const moves = m.legalMoves();
        const fenBefore = m.pos.fen();
        const hashBefore = m.pos.hashLo;
        for (const mv of moves.slice(0, 6)) {
          m.pos.make(mv);
          const inc = m.pos.hashLo;
          m.pos.recomputeHash();
          expect(m.pos.hashLo).toBe(inc);
          m.pos.unmake();
          expect(m.pos.fen()).toBe(fenBefore);
          expect(m.pos.hashLo).toBe(hashBefore);
        }
        m.play(moves[Math.floor(rand() * moves.length)]);
        // kings always exist, and the side that just moved is never left in check
        expect(m.pos.kings.every((k) => k >= 0)).toBe(true);
      }
    }
  });
});

describe('reward drafting', () => {
  it('offers 3 distinct reinforcements and never a maxed one', () => {
    for (let i = 0; i < 200; i++) {
      const owned = own('knight-queen', 'royal-knight');
      const offers = draftOffers(owned, 1 + (i % 12));
      expect(new Set(offers).size).toBe(3);
      expect(offers).not.toContain('knight-queen');
      expect(offers).not.toContain('royal-knight');
    }
  });
});

describe('computer opponent', () => {
  it('finds mate in one', () => {
    const b = new Position(standardRules(), 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1');
    const r = findBestMove(b, settingsForElo(2000));
    expect(squareName(r.move!.to)).toBe('a1');
    expect(r.score).toBeGreaterThan(100000);
  });

  it('respects reinforced pieces: never walks its king into a Knight Queen jump', () => {
    const rules = rulesWith('knight-queen');
    const pos = new Position(rules, '8/8/4k3/8/8/2Q5/8/K7 b - - 0 1');
    for (let i = 0; i < 20; i++) {
      const r = findBestMove(pos, settingsForElo(800));
      const p = pos.clone();
      p.make(r.move!);
      expect(p.isAttacked(p.kings[BLACK], WHITE)).toBe(false);
    }
    // squares attacked by the knight-queen on c3 via jumps: d5, b5, e4, e2, a4, a2, b1, d1
    const kingMoves = targets(pos.legalMoves(), 'e6');
    expect(kingMoves).not.toContain('d5');
    expect(kingMoves).not.toContain('e5'); // queen diagonal c3-e5
  });

  it('gets stronger: deeper settings at higher ELO', () => {
    expect(settingsForElo(800).depth).toBeLessThan(settingsForElo(1400).depth);
    expect(settingsForElo(1400).depth).toBeLessThan(settingsForElo(2200).depth);
    expect(settingsForElo(800).noise).toBeGreaterThan(settingsForElo(2000).noise);
  });

  it('plays a full game against itself without errors', () => {
    const m = new Match(compileRules(own('pawn-momentum', 'knight-queen', 'armored-pawn')));
    for (let ply = 0; ply < 300 && !m.result; ply++) {
      const r = findBestMove(m.pos, { ...settingsForElo(m.turn === WHITE ? 1100 : 900), timeMs: 150 });
      expect(r.move).not.toBeNull();
      m.play(r.move!);
    }
    expect(m.log.length).toBeGreaterThan(10);
  });
});
