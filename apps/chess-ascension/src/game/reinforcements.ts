import {
  AMAZON,
  ARCHBISHOP,
  BISHOP,
  CHANCELLOR,
  DIAG_DIRS,
  KING,
  KNIGHT,
  KNIGHT_OFFSETS,
  ORTHO_DIRS,
  PAWN,
  QUEEN,
  ROOK,
} from '../engine/constants';
import { RuleBuilder, compileSide, defaultSideRules, type CompiledRules } from '../engine/rules';

export type Rarity = 'common' | 'rare' | 'legendary';
export type ReinforcementKind = 'movement' | 'passive' | 'ability' | 'setup';
export type BadgeKey =
  | 'bolt'
  | 'horse'
  | 'crown'
  | 'shield'
  | 'twin'
  | 'plus'
  | 'star'
  | 'rewind'
  | 'arrow'
  | 'swap'
  | 'clock'
  | 'bomb'
  | 'jump';

export interface ReinforcementIcon {
  /** piece type drawn as the icon base (0 = no piece, badge only) */
  piece: number;
  badge: BadgeKey;
}

/**
 * A Reinforcement is pure data plus an apply() that edits the player's RuleSet.
 * The board, move generator and AI never special-case reinforcement ids: they only read the compiled rules.
 * To add a new reinforcement, append an entry here (and, if it needs a brand-new kind of rule,
 * add a field to SideRules and teach Position about it once).
 */
export interface Reinforcement {
  id: string;
  name: string;
  description: string;
  /** one-line explanation of how it changes play */
  impact: string;
  rarity: Rarity;
  kind: ReinforcementKind;
  icon: ReinforcementIcon;
  /** piece type it applies to, or null for army-wide effects */
  piece: number | null;
  stackable: boolean;
  maxStacks: number;
  /** how stacking changes the effect (shown on cards) */
  stackText?: string;
  apply(rules: RuleBuilder, stacks: number): void;
}

const ONE_DIAG = DIAG_DIRS;
const ONE_ORTHO = ORTHO_DIRS;
const TWO_ORTHO = [32, -32, 2, -2];

export const REINFORCEMENTS: Reinforcement[] = [
  {
    id: 'pawn-momentum',
    name: 'Pawn Momentum',
    description: 'After one of your pawns captures, that same pawn may immediately make another legal move.',
    impact: 'Pawn trades become double-tempo raids. You may also skip the bonus.',
    rarity: 'common',
    kind: 'passive',
    icon: { piece: PAWN, badge: 'bolt' },
    piece: PAWN,
    stackable: true,
    maxStacks: 3,
    stackText: 'Each stack lets a capturing bonus move chain into one more bonus move.',
    apply: (r, stacks) => {
      r.rules.momentum += stacks;
    },
  },
  {
    id: 'knight-queen',
    name: 'Knight Queen',
    description: 'Your queen can move normally or jump like a knight.',
    impact: 'Queen forks from impossible angles and escapes through walls of pawns.',
    rarity: 'rare',
    kind: 'movement',
    icon: { piece: QUEEN, badge: 'horse' },
    piece: QUEEN,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(QUEEN, KNIGHT_OFFSETS, 'knight-queen'),
  },
  {
    id: 'royal-knight',
    name: 'Royal Knight',
    description: 'Your knights can also step one square diagonally in any direction.',
    impact: 'Knights stop being clumsy up close and can shuffle to perfect outposts.',
    rarity: 'common',
    kind: 'movement',
    icon: { piece: KNIGHT, badge: 'crown' },
    piece: KNIGHT,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(KNIGHT, ONE_DIAG, 'royal-knight'),
  },
  {
    id: 'armored-pawn',
    name: 'Armored Pawn',
    description: 'The first time each of your pawns would be captured, the capture fails and the pawn survives.',
    impact: 'The attacker stays on its square and wastes its turn; the armor breaks.',
    rarity: 'common',
    kind: 'passive',
    icon: { piece: PAWN, badge: 'shield' },
    piece: PAWN,
    stackable: true,
    maxStacks: 3,
    stackText: 'Each stack adds one more layer of armor to every pawn.',
    apply: (r, stacks) => {
      r.rules.pawnArmor += stacks;
    },
  },
  {
    id: 'twin-strike',
    name: 'Twin Strike',
    description: 'Once per game, arm Twin Strike: your next rook (or queen) move is followed by a second move with that same piece.',
    impact: 'Hit, then hit again. Combine with Knight Queen for a queen double-jump.',
    rarity: 'rare',
    kind: 'ability',
    icon: { piece: ROOK, badge: 'twin' },
    piece: ROOK,
    stackable: true,
    maxStacks: 3,
    stackText: 'Each stack adds one more use per game.',
    apply: (r, stacks) => {
      r.rules.twinStrikeCharges += stacks;
    },
  },
  {
    id: 'bishops-reach',
    name: "Bishop's Reach",
    description: 'Your bishops may also step one square horizontally or vertically.',
    impact: 'Bishops can finally change square colour.',
    rarity: 'common',
    kind: 'movement',
    icon: { piece: BISHOP, badge: 'plus' },
    piece: BISHOP,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(BISHOP, ONE_ORTHO, 'bishops-reach'),
  },
  {
    id: 'royal-reinforcement',
    name: 'Royal Reinforcement',
    description: 'Your king may also move like a knight. King safety rules still apply.',
    impact: 'Your king hops out of mating nets that would trap a normal king.',
    rarity: 'rare',
    kind: 'movement',
    icon: { piece: KING, badge: 'horse' },
    piece: KING,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(KING, KNIGHT_OFFSETS, 'royal-reinforcement'),
  },
  {
    id: 'queens-guard',
    name: "Queen's Guard",
    description: 'Your queen cannot be captured unless the capturing piece is protected by another enemy piece.',
    impact: 'Lone attackers bounce off her. Only defended pieces may take her.',
    rarity: 'common',
    kind: 'passive',
    icon: { piece: QUEEN, badge: 'shield' },
    piece: QUEEN,
    stackable: false,
    maxStacks: 1,
    apply: (r) => {
      r.rules.queensGuard = true;
    },
  },
  {
    id: 'promotion-plus',
    name: 'Pawn Promotion+',
    description:
      'Pawns may also promote to an Archbishop (bishop + knight) or a Chancellor (rook + knight). With Knight Queen, also to an Amazon (queen + knight).',
    impact: 'Promoted pieces inherit every upgrade of the pieces they combine.',
    rarity: 'rare',
    kind: 'movement',
    icon: { piece: PAWN, badge: 'star' },
    piece: PAWN,
    stackable: false,
    maxStacks: 1,
    apply: (r) => {
      r.addPromotion(ARCHBISHOP);
      r.addPromotion(CHANCELLOR);
      if (r.has('knight-queen')) r.addPromotion(AMAZON);
    },
  },
  {
    id: 'second-wind',
    name: 'Second Wind',
    description: 'Once per game, if you are checkmated, time rewinds to before your last move and play continues.',
    impact: 'One free mistake per game. Triggers automatically.',
    rarity: 'legendary',
    kind: 'ability',
    icon: { piece: KING, badge: 'rewind' },
    piece: KING,
    stackable: true,
    maxStacks: 2,
    stackText: 'Each stack adds one more rewind per game.',
    apply: (r, stacks) => {
      r.rules.secondWindCharges += stacks;
    },
  },
  {
    id: 'royal-rook',
    name: 'Royal Rook',
    description: 'Your rooks can also move one square diagonally, like a king.',
    impact: 'Rooks slip around blockers and defend diagonally.',
    rarity: 'common',
    kind: 'movement',
    icon: { piece: ROOK, badge: 'crown' },
    piece: ROOK,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(ROOK, ONE_DIAG, 'royal-rook'),
  },
  {
    id: 'pawn-sprint',
    name: 'Pawn Sprint',
    description: 'Your pawns may advance two squares from any rank, not just the starting rank.',
    impact: 'Passed pawns race to promotion twice as fast.',
    rarity: 'common',
    kind: 'movement',
    icon: { piece: PAWN, badge: 'arrow' },
    piece: PAWN,
    stackable: false,
    maxStacks: 1,
    apply: (r) => {
      r.rules.pawnDoubleAnywhere = true;
    },
  },
  {
    id: 'sidestep',
    name: 'Sidestep',
    description: 'Your pawns may move one square sideways (without capturing).',
    impact: 'Unblock files, dodge attacks and line pawns up for captures.',
    rarity: 'common',
    kind: 'movement',
    icon: { piece: PAWN, badge: 'swap' },
    piece: PAWN,
    stackable: false,
    maxStacks: 1,
    apply: (r) => {
      r.rules.pawnSidestep = true;
    },
  },
  {
    id: 'leaping-knights',
    name: 'Leaping Knights',
    description: 'Your knights may also jump exactly two squares straight up, down, left or right.',
    impact: 'Knights gain reach and can hop over blockers in straight lines.',
    rarity: 'common',
    kind: 'movement',
    icon: { piece: KNIGHT, badge: 'jump' },
    piece: KNIGHT,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(KNIGHT, TWO_ORTHO, 'leaping-knights'),
  },
  {
    id: 'cardinal-bishops',
    name: 'Cardinal Bishops',
    description: 'Your bishops may also move like knights.',
    impact: 'Each bishop becomes a fork machine that ignores blockades.',
    rarity: 'rare',
    kind: 'movement',
    icon: { piece: BISHOP, badge: 'horse' },
    piece: BISHOP,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(BISHOP, KNIGHT_OFFSETS, 'cardinal-bishops'),
  },
  {
    id: 'cavalry-rooks',
    name: 'Cavalry Rooks',
    description: 'Your rooks may also move like knights.',
    impact: 'Rooks join the fight on move one, jumping over their own pawns.',
    rarity: 'rare',
    kind: 'movement',
    icon: { piece: ROOK, badge: 'horse' },
    piece: ROOK,
    stackable: false,
    maxStacks: 1,
    apply: (r) => r.addLeaps(ROOK, KNIGHT_OFFSETS, 'cavalry-rooks'),
  },
  {
    id: 'time-warp',
    name: 'Time Warp',
    description: 'Once per game, arm Time Warp: after your next move, take a second full move with any piece.',
    impact: 'Two moves in a row. Set up a threat and cash it in before they can react.',
    rarity: 'legendary',
    kind: 'ability',
    icon: { piece: 0, badge: 'clock' },
    piece: null,
    stackable: true,
    maxStacks: 2,
    stackText: 'Each stack adds one more use per game.',
    apply: (r, stacks) => {
      r.rules.timeWarpCharges += stacks;
    },
  },
  {
    id: 'sabotage',
    name: 'Sabotage',
    description: 'Each game, the computer starts with one random pawn missing.',
    impact: 'Open lines against the enemy king from move one.',
    rarity: 'rare',
    kind: 'setup',
    icon: { piece: 0, badge: 'bomb' },
    piece: null,
    stackable: true,
    maxStacks: 3,
    stackText: 'Each stack removes one more enemy pawn.',
    apply: (r, stacks) => {
      r.rules.sabotagePawns += stacks;
    },
  },
];

export const REINFORCEMENT_BY_ID: Record<string, Reinforcement> = Object.fromEntries(REINFORCEMENTS.map((r) => [r.id, r]));

export interface OwnedReinforcement {
  id: string;
  stacks: number;
  round: number;
}

/** Compile the full rule set for a game: the player (White) gets every owned reinforcement, the computer plays standard chess. */
export function compileRules(owned: OwnedReinforcement[]): CompiledRules {
  const builder = new RuleBuilder(owned.map((o) => o.id));
  for (const def of REINFORCEMENTS) {
    const o = owned.find((x) => x.id === def.id);
    if (o) def.apply(builder, o.stacks);
  }
  return { sides: [compileSide(builder.rules), compileSide(defaultSideRules())] };
}

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

/**
 * Draft 3 distinct, meaningful reinforcement offers.
 * - never offers a maxed or owned non-stackable reinforcement
 * - rarity odds improve with the round
 * - discourages offering several upgrades for the same piece at once
 */
export function draftOffers(owned: OwnedReinforcement[], round: number, rand: () => number = Math.random, count = 3): string[] {
  const legendaryW = Math.min(4 + round * 1.5, 18);
  const rareW = Math.min(24 + round * 2, 38);
  const commonW = 100 - legendaryW - rareW;
  const rarityWeight: Record<Rarity, number> = { common: commonW, rare: rareW, legendary: legendaryW };
  const available = REINFORCEMENTS.filter((def) => {
    const o = owned.find((x) => x.id === def.id);
    if (!o) return true;
    return def.stackable && o.stacks < def.maxStacks;
  });
  const picks: Reinforcement[] = [];
  while (picks.length < count && picks.length < available.length) {
    const pool = available.filter((d) => !picks.includes(d));
    const weights = pool.map((d) => {
      let w = rarityWeight[d.rarity];
      if (picks.some((p) => p.piece !== null && p.piece === d.piece)) w *= 0.15;
      if (picks.some((p) => p.rarity === d.rarity && d.rarity !== 'common')) w *= 0.6;
      if (owned.some((o) => o.id === d.id)) w *= 0.55; // prefer new powers over extra stacks
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rand() * total;
    let idx = 0;
    while (idx < pool.length - 1 && roll >= weights[idx]) {
      roll -= weights[idx];
      idx++;
    }
    picks.push(pool[idx]);
  }
  return picks.map((p) => p.id);
}

export function addReinforcement(owned: OwnedReinforcement[], id: string, round: number): OwnedReinforcement[] {
  const existing = owned.find((o) => o.id === id);
  if (existing) return owned.map((o) => (o.id === id ? { ...o, stacks: Math.min(o.stacks + 1, REINFORCEMENT_BY_ID[id].maxStacks) } : o));
  return [...owned, { id, stacks: 1, round }];
}
