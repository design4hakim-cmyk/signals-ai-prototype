import type { Candle } from '@/types/market';

/*
  Signals engine (mock, but real maths).
  The demo strategy: Entry = EMA 9 crosses above EMA 21, Exit = EMA 9 crosses below EMA 21.
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

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

const dayOf = (t: number) => Math.floor(t / 86400);

export function computeSignals(candles: Candle[], limits: Limits): SignalResult {
  const close = candles.map((c) => c.close);
  const fast = ema(close, 9);
  const slow = ema(close, 21);

  const trades: Trade[] = [];
  const open: Trade[] = [];
  const perDayCount = new Map<number, number>();
  let skipped = 0;

  for (let i = 22; i < candles.length; i++) {
    const crossUp = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
    const crossDown = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
    const c = candles[i];

    if (crossDown && open.length) {
      // exit closes every open trade (simple strategy)
      for (const t of open.splice(0)) {
        t.exitTime = c.time;
        t.exitPrice = c.close;
      }
    }
    if (crossUp) {
      const d = dayOf(c.time);
      const today = perDayCount.get(d) ?? 0;
      const blocked =
        (limits.openAtOnce !== null && open.length >= limits.openAtOnce) ||
        (limits.perDay !== null && today >= limits.perDay);
      if (blocked) {
        skipped++;
        continue;
      }
      perDayCount.set(d, today + 1);
      const t: Trade = { entryTime: c.time, entryPrice: c.close, exitTime: null, exitPrice: null };
      trades.push(t);
      open.push(t);
    }
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
