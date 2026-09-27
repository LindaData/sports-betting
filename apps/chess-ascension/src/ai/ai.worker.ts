import { Position } from '../engine/position';
import type { AiRequest, AiResponse } from './protocol';
import { Searcher } from './search';

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, position, rules, settings } = event.data;
  try {
    const pos = Position.fromData(rules, position);
    const r = new Searcher(pos).run(settings);
    const move = r.move ? { from: r.move.from, to: r.move.to, promo: r.move.promo, flags: r.move.flags } : null;
    const reply: AiResponse = { id, move, score: r.score, depth: r.depth, nodes: r.nodes };
    self.postMessage(reply);
  } catch (e) {
    const reply: AiResponse = { id, move: null, score: 0, depth: 0, nodes: 0, error: String(e) };
    self.postMessage(reply);
  }
};
