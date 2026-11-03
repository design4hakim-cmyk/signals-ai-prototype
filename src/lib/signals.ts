import type { Candle } from '@/types/market';
import type { Condition, Group, Operand, StrategyTree } from '@/types/strategy';
import { operandSeries } from './indicators';

/*
  Signals engine (mock prices, real maths).
  Reads the conditions built on the canvas (entry + exit trees).
  Limits then filter entries: max trades open at once, max entries per day.
*/

export interface Limits {
  openAtOnce: number | null; // null = no limit
  perDay: number | null;
}

export interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number | null; // null = still open, waiting for exit
  exitPrice: number | null;
}

export interface SignalResult {
  entries: number;
  exits: number;
  skipped: number; // entries the limits held back
  trades: Trade[];
}

/** Is the condition true on candle i? Half-built conditions never count. */
function conditionAt(c: Condition, i: number, series: (o: Operand) => number[]) {
  if (!c.left || !c.relation || !c.right) return null;
  const a = series(c.left);
  const b = series(c.right);
  const [x, y, px, py] = [a[i], b[i], a[i - 1], b[i - 1]];
  if ([x, y].some(Number.isNaN)) return false;
  const near = Math.abs(x - y) <= Math.max(Math.abs(y), 1) * 0.0005; // "Equals" on prices needs a little slack
  switch (c.relation) {
    case 'Equals': return near;
    case 'Not Equal': return !near;
    case 'Greater Than': return x > y;
    case 'Greater Than or Equal': return x >= y;
    case 'Less Than': return x < y;
    case 'Less Than or Equal': return x <= y;
    case 'Cross Above': return px <= py && x > y;
    case 'Cross Below': return px >= py && x < y;
  }
}

/** All of = every part true · Any of = one is enough · None of = none true. null = nothing finished inside. */
function groupAt(g: Group, i: number, series: (o: Operand) => number[]): boolean | null {
  const parts = g.children
    .map((ch) => (ch.kind === 'cond' ? conditionAt(ch, i, series) : groupAt(ch, i, series)))
    .filter((v): v is boolean => v !== null);
  if (!parts.length) return null;
  if (g.logic === 'NONE') return parts.every((p) => !p);
  return g.logic === 'AND' ? parts.every(Boolean) : parts.some(Boolean);
}

const dayOf = (t: number) => Math.floor(t / 86400);

/**
 * Walk the candles: an entry fires when the Entry conditions BECOME true,
 * an exit when the Exit conditions become true (closing every open trade).
 */
export function computeSignals(candles: Candle[], limits: Limits, strategy: StrategyTree): SignalResult {
  const cache = new Map<string, number[]>();
  const series = (o: Operand) => {
    const k = JSON.stringify(o);
    if (!cache.has(k)) cache.set(k, operandSeries(candles, o));
    return cache.get(k)!;
  };

  const trades: Trade[] = [];
  const open: Trade[] = [];
  const perDayCount = new Map<number, number>();
  let skipped = 0;
  let wasEntry = true; // no entry on the very first candle
  let wasExit = true;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const isEntry = groupAt(strategy.entry, i, series) === true;
    const isExit = groupAt(strategy.exit, i, series) === true;

    if (isExit && !wasExit && open.length) {
      for (const t of open.splice(0)) {
        t.exitTime = c.time;
        t.exitPrice = c.close;
      }
    }
    if (isEntry && !wasEntry) {
      const d = dayOf(c.time);
      const today = perDayCount.get(d) ?? 0;
      const blocked =
        (limits.openAtOnce !== null && open.length >= limits.openAtOnce) ||
        (limits.perDay !== null && today >= limits.perDay);
      if (blocked) skipped++;
      else {
        perDayCount.set(d, today + 1);
        const t: Trade = { entryTime: c.time, entryPrice: c.close, exitTime: null, exitPrice: null };
        trades.push(t);
        open.push(t);
      }
    }
    wasEntry = isEntry;
    wasExit = isExit;
  }
  return {
    entries: trades.length,
    exits: trades.filter((t) => t.exitTime !== null).length,
    skipped,
    trades,
  };
}

/* ── Formatting helpers used by the log ─────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtTime(t: number) {
  const d = new Date(t * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function fmtDate(t: number) {
  const d = new Date(t * 1000);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fmtPrice(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtHeld(seconds: number) {
  const m = Math.round(seconds / 60);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return mm ? `${h}h ${mm}m` : `${h}h`;
  return `${mm}m`;
}
export const fmtSigned = (n: number) => `${n >= 0 ? '+' : '−'}${fmtPrice(Math.abs(n))}`;
