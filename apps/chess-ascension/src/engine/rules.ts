import {
  AMAZON,
  ARCHBISHOP,
  BISHOP,
  CHANCELLOR,
  DIAG_DIRS,
  KING,
  KING_OFFSETS,
  KNIGHT,
  KNIGHT_OFFSETS,
  NON_PAWN_TYPES,
  ORTHO_DIRS,
  QUEEN,
  ROOK,
} from './constants';

/**
 * Movement rules are data, not code. Reinforcements edit a RuleSet through the RuleBuilder,
 * and the engine derives move generation and attack detection from the compiled result.
 * The same compiled rules drive the player's legal moves, the king-safety checks, and the AI's search.
 */

export interface MoveComponent {
  /** 0x88 offset (direction for slides, jump for leaps) */
  off: number;
  /** true when the component was granted by a reinforcement (highlighted differently in the UI) */
  special: boolean;
  /** reinforcement id that granted it (for UI tooltips) */
  source?: string;
}

export interface PieceProfile {
  slides: MoveComponent[];
  leaps: MoveComponent[];
}

export interface SideRules {
  /** indexed by piece type; index 0 and PAWN are unused */
  profiles: PieceProfile[];
  pawnDoubleAnywhere: boolean;
  pawnSidestep: boolean;
  /** Pawn Momentum stacks: number of bonus moves a capturing pawn may chain */
  momentum: number;
  queensGuard: boolean;
  /** armor charges each pawn starts the game with */
  pawnArmor: number;
  /** promotion choices (piece types) */
  promotions: number[];
  /** piece types that trigger an armed Twin Strike */
  twinStrikeTypes: number[];
  /** once-per-game ability charges */
  twinStrikeCharges: number;
  timeWarpCharges: number;
  secondWindCharges: number;
  /** setup: number of enemy pawns removed before each game */
  sabotagePawns: number;
}

export interface AttackEntry {
  off: number;
  /** bitmask of piece types (1 << type) that attack along this offset */
  mask: number;
}

export interface CompiledSide extends SideRules {
  leapAttacks: AttackEntry[];
  slideAttacks: AttackEntry[];
  /** true if a piece type moves exactly like standard chess (used for insufficient-material rules) */
  standard: boolean[];
}

export interface CompiledRules {
  sides: [CompiledSide, CompiledSide];
}

const comp = (offs: number[]): MoveComponent[] => offs.map((off) => ({ off, special: false }));

function baseProfiles(): PieceProfile[] {
  const profiles: PieceProfile[] = [];
  for (let t = 0; t <= AMAZON; t++) profiles.push({ slides: [], leaps: [] });
  profiles[KNIGHT].leaps = comp(KNIGHT_OFFSETS);
  profiles[BISHOP].slides = comp(DIAG_DIRS);
  profiles[ROOK].slides = comp(ORTHO_DIRS);
  profiles[QUEEN].slides = comp([...ORTHO_DIRS, ...DIAG_DIRS]);
  profiles[KING].leaps = comp(KING_OFFSETS);
  return profiles;
}

export function defaultSideRules(): SideRules {
  return {
    profiles: baseProfiles(),
    pawnDoubleAnywhere: false,
    pawnSidestep: false,
    momentum: 0,
    queensGuard: false,
    pawnArmor: 0,
    promotions: [QUEEN, ROOK, BISHOP, KNIGHT],
    twinStrikeTypes: [ROOK, QUEEN, CHANCELLOR, AMAZON],
    twinStrikeCharges: 0,
    timeWarpCharges: 0,
    secondWindCharges: 0,
    sabotagePawns: 0,
  };
}

/** Mutable builder handed to each reinforcement's apply() */
export class RuleBuilder {
  readonly rules: SideRules = defaultSideRules();
  private readonly owned: Set<string>;

  constructor(ownedIds: Iterable<string>) {
    this.owned = new Set(ownedIds);
  }

  has(id: string): boolean {
    return this.owned.has(id);
  }

  /** Grant extra leap offsets to a piece type. Offsets already reachable are skipped. */
  addLeaps(type: number, offsets: number[], source: string): void {
    const prof = this.rules.profiles[type];
    for (const off of offsets) {
      if (prof.leaps.some((c) => c.off === off)) continue;
      if (prof.slides.some((c) => c.off === off)) continue; // one-step already covered by a slide
      prof.leaps.push({ off, special: true, source });
    }
  }

  /** Grant extra slide directions to a piece type. */
  addSlides(type: number, dirs: number[], source: string): void {
    const prof = this.rules.profiles[type];
    for (const off of dirs) {
      if (prof.slides.some((c) => c.off === off)) continue;
      prof.slides.push({ off, special: true, source });
      prof.leaps = prof.leaps.filter((c) => c.off !== off);
    }
  }

  addPromotion(type: number): void {
    if (!this.rules.promotions.includes(type)) this.rules.promotions.push(type);
  }
}

function unionProfiles(...profiles: PieceProfile[]): PieceProfile {
  const out: PieceProfile = { slides: [], leaps: [] };
  for (const p of profiles) {
    for (const s of p.slides) {
      if (!out.slides.some((c) => c.off === s.off)) out.slides.push({ ...s });
    }
  }
  for (const p of profiles) {
    for (const l of p.leaps) {
      if (out.slides.some((c) => c.off === l.off) || out.leaps.some((c) => c.off === l.off)) continue;
      out.leaps.push({ ...l });
    }
  }
  return out;
}

const withoutSpecial = (p: PieceProfile): PieceProfile => ({
  slides: p.slides.map((c) => ({ ...c, special: false, source: undefined })),
  leaps: p.leaps.map((c) => ({ ...c, special: false, source: undefined })),
});

/** Finalize a side: derive compound pieces from their (possibly modified) components and build attack tables. */
export function compileSide(rules: SideRules): CompiledSide {
  const profiles = rules.profiles.map((p) => ({ slides: [...p.slides], leaps: [...p.leaps] }));
  // Compound pieces inherit the reinforced movement of each component piece.
  // The component movement itself is innate to the compound piece, so only reinforcement extras stay "special".
  const base = baseProfiles();
  const innate = (a: number, b: number) => withoutSpecial(unionProfiles(base[a], base[b]));
  const merge = (a: number, b: number) => {
    const u = unionProfiles(profiles[a], profiles[b]);
    const inn = innate(a, b);
    const isInnate = (c: MoveComponent, list: MoveComponent[]) => list.some((x) => x.off === c.off);
    return {
      slides: u.slides.map((c) => (isInnate(c, inn.slides) ? { ...c, special: false } : c)),
      leaps: u.leaps.map((c) => (isInnate(c, inn.leaps) ? { ...c, special: false } : c)),
    };
  };
  profiles[ARCHBISHOP] = merge(BISHOP, KNIGHT);
  profiles[CHANCELLOR] = merge(ROOK, KNIGHT);
  profiles[AMAZON] = merge(QUEEN, KNIGHT);

  const leapMap = new Map<number, number>();
  const slideMap = new Map<number, number>();
  for (const t of NON_PAWN_TYPES) {
    for (const c of profiles[t].leaps) leapMap.set(c.off, (leapMap.get(c.off) ?? 0) | (1 << t));
    for (const c of profiles[t].slides) slideMap.set(c.off, (slideMap.get(c.off) ?? 0) | (1 << t));
  }
  const standardBase = baseProfiles();
  const standard = profiles.map((p, t) => {
    if (t === 0) return true;
    const b = standardBase[t];
    return (
      p.leaps.length === b.leaps.length &&
      p.slides.length === b.slides.length &&
      !p.leaps.some((c) => c.special) &&
      !p.slides.some((c) => c.special)
    );
  });
  return {
    ...rules,
    profiles,
    leapAttacks: [...leapMap].map(([off, mask]) => ({ off, mask })),
    slideAttacks: [...slideMap].map(([off, mask]) => ({ off, mask })),
    standard,
  };
}

export function standardRules(): CompiledRules {
  return { sides: [compileSide(defaultSideRules()), compileSide(defaultSideRules())] };
}
