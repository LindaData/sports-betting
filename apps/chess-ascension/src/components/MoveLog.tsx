import { useEffect, useRef } from 'react';
import type { LogEntry } from '../game/match';

export function MoveLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  // group into turns: a turn is a White sequence (incl. bonus moves) followed by Black's reply
  const turns: { white: LogEntry[]; black: LogEntry[] }[] = [];
  for (const e of log) {
    if (e.color === 0) {
      if (!e.bonus || !turns.length) turns.push({ white: [e], black: [] });
      else turns[turns.length - 1].white.push(e);
    } else {
      if (!turns.length) turns.push({ white: [], black: [] });
      turns[turns.length - 1].black.push(e);
    }
  }
  return (
    <section className="panel movelog" aria-label="Move list">
      <h2 className="panel__title">Moves</h2>
      {turns.length === 0 ? <p className="muted small">You play the cream pieces and move first.</p> : null}
      <ol ref={ref} className="movelog__list">
        {turns.map((t, i) => (
          <li key={i}>
            <span className="movelog__num">{i + 1}.</span>
            <span className="movelog__w">
              {t.white.map((e, j) => (
                <span key={j} className={`${e.bonus ? 'san--bonus' : ''} ${e.special ? 'san--special' : ''}`}>
                  {j > 0 ? ' › ' : ''}
                  {e.san}
                </span>
              ))}
            </span>
            <span className="movelog__b">{t.black.map((e) => e.san).join(' ')}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
