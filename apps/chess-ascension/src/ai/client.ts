import type { Move, Position } from '../engine/position';
import type { AiRequest, AiResponse } from './protocol';
import { Searcher, type AiSettings } from './search';

/**
 * Runs the search in a Web Worker so the board stays responsive while the computer thinks.
 * Falls back to the main thread if workers are unavailable.
 */
export class AiClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: AiResponse) => void>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
        const resolve = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        resolve?.(e.data);
      };
      this.worker.onerror = () => {
        // a broken worker falls back to the main thread for this and later requests
        this.worker?.terminate();
        this.worker = null;
        for (const [id, resolve] of this.pending) resolve({ id, move: null, score: 0, depth: 0, nodes: 0, error: 'worker failed' });
        this.pending.clear();
      };
    } catch {
      this.worker = null;
    }
  }

  /** Ask for a move; resolves no sooner than minMs so the computer's reply is readable. */
  async chooseMove(pos: Position, settings: AiSettings, minMs = 0): Promise<Move | null> {
    const started = performance.now();
    const move = await this.search(pos, settings);
    const elapsed = performance.now() - started;
    if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
    return move;
  }

  private async search(pos: Position, settings: AiSettings): Promise<Move | null> {
    const legal = pos.legalMoves();
    if (!legal.length) return null;
    let reply: AiResponse | null = null;
    if (this.worker) {
      const id = this.nextId++;
      const req: AiRequest = { id, position: pos.toData(), rules: pos.rules, settings };
      reply = await new Promise<AiResponse>((resolve) => {
        this.pending.set(id, resolve);
        this.worker!.postMessage(req);
      });
      if (reply.error) reply = null;
    }
    if (!reply) {
      await new Promise((r) => setTimeout(r, 0));
      const r = new Searcher(pos.clone()).run(settings);
      reply = r.move ? { id: 0, move: r.move, score: r.score, depth: r.depth, nodes: r.nodes } : null;
    }
    const m = reply?.move;
    if (!m) return legal[0];
    return legal.find((x) => x.from === m.from && x.to === m.to && x.promo === m.promo && x.flags === m.flags) ?? legal[0];
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
