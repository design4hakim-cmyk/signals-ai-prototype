import raw from '../../design/backtest-results/mock-results.json';

/*
  Backtest results data (design/backtest-results/mock-results.json).
  The 17 statistics, the year-wise table, the equity curve and the first 10 trades
  are the real AlgoTest run. Trades 11–246 are generated (seeded) with the same
  shape, and each month's trades add up to that month's real total — so when the
  VIX filter recalculates everything from the trades, the picture stays the same.
  Every number on the page can be recalculated from any list of trades.
*/

export interface Leg {
  type: 'CE' | 'PE';
  strike: number;
  side: 'Sell' | 'Buy';
  qty: number;
  entryPrice: number;
  exitPrice: number;
  exitTime: string;
  pnl: number;
}
export interface Trade {
  n: number;
  date: string; // "03 Nov 2025"
  iso: string; // "2025-11-03"
  entry: string;
  exit: string;
  vix: number;
  pnl: number;
  legs: Leg[];
}
export interface Stats {
  profit: number;
  trades: number;
  avg: number;
  win: number;
  loss: number;
  avgwin: number;
  avgloss: number;
  maxwin: number;
  maxloss: number;
  mdd: number;
  mdd_days: number;
  mdd_from: string;
  mdd_to: string;
  ret_dd: number;
  rr: number;
  exp: number;
  wstreak: number;
  lstreak: number;
  dd_trades: number;
  wins: number;
}
export interface EquityPoint {
  date: string; // ISO
  cumPnl: number;
  drawdown: number;
  nifty: number;
  dayPnl: number;
}
export interface YearRow {
  year: number;
  months: (number | null)[];
  total: number;
  maxDrawdown: number;
}
export interface MonthInfo {
  trades: number;
  winRate: number;
}

export const SETUP = raw.setup;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fullMonth = (m: number) => FULL_MONTHS[m];

/* ── Formatting: ₹ with Indian grouping, true minus sign ───────── */

const MINUS = '−';
export function rupees(n: number, opts: { decimals?: number; plus?: boolean } = {}) {
  const d = opts.decimals ?? (Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
  const s = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${n < 0 ? MINUS : n > 0 && opts.plus ? '+' : ''}₹${s}`;
}
/** "+20.1K" / "−14.5K" for heatmap cells */
export const kilo = (n: number) => `${n < 0 ? MINUS : '+'}${(Math.abs(n) / 1000).toFixed(1)}K`;
/** "−₹24.7K" for the Copilot summary */
export const kiloRupees = (n: number) => `${n < 0 ? MINUS : ''}₹${(Math.abs(n) / 1000).toFixed(1)}K`;
export const num = (n: number, d = 2) => `${n < 0 ? MINUS : ''}${Math.abs(n).toFixed(d)}`;
export const tone = (n: number) => (n > 0 ? 'text-pnl-up' : n < 0 ? 'text-pnl-down' : 'text-text-primary');

const MON = MONTHS;
export const isoToLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MON[m - 1]} ${y}`;
};
const labelToIso = (label: string) => {
  const [d, m, y] = label.split(' ');
  return `${y}-${String(MON.indexOf(m) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
};
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/* ── Seeded generation of trades 11–246 ────────────────────────── */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const realTrades: Trade[] = raw.trades.map((t) => ({
  ...t,
  iso: labelToIso(t.date),
  legs: t.legs.map((l) => ({ ...l, type: l.type as Leg['type'], side: l.side as Leg['side'] })),
}));

function generateTrades(): Trade[] {
  const r = rng(246);
  const total = raw.tradesTotal;
  const days = raw.equity.map((e) => e.date);
  const last = realTrades[realTrades.length - 1].iso;
  // trading days after the last real trade; skip some so the count comes out at 246
  const pool = days.filter((d) => d > last);
  const need = total - realTrades.length;
  const skip = new Set<number>();
  while (pool.length - skip.size > need) skip.add(Math.floor(r() * pool.length));
  const dates = pool.filter((_, i) => !skip.has(i));

  // VIX: 158 of all 246 between 12 and 20 (the board's example)
  const inRange = realTrades.filter((t) => t.vix >= 12 && t.vix <= 20).length;
  const wantIn = raw.vixFilter.example.matchingTrades - inRange;
  const vixes = dates.map((_, i) => (i < wantIn ? 12.05 + r() * 7.9 : r() < 0.6 ? 10 + r() * 1.95 : 20.1 + r() * 4));
  for (let i = vixes.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [vixes[i], vixes[j]] = [vixes[j], vixes[i]];
  }

  // P&L: each month's trades add up to that month's real total
  const monthTotal = (iso: string) => {
    const [y, m] = iso.split('-').map(Number);
    return (raw.yearWise as Record<string, { months: (number | null)[] }>)[String(y)]?.months[m - 1] ?? 0;
  };
  const byMonth = new Map<string, number[]>();
  dates.forEach((d, i) => {
    const k = d.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), i]);
  });
  const pnl = new Array<number>(dates.length).fill(0);
  for (const [k, idx] of byMonth) {
    const fixed = realTrades.filter((t) => t.iso.startsWith(k)).reduce((a, t) => a + t.pnl, 0);
    const S = monthTotal(`${k}-01`) - fixed;
    const n = idx.length;
    // more winners in good months
    const p = Math.min(0.72, Math.max(0.22, 0.425 + S / (n * 2600 * 4)));
    const wins = idx.filter(() => r() < p);
    const losses = idx.filter((i) => !wins.includes(i));
    // scale so the month adds up: wins average ≈ ₹2,562, losses ≈ ₹2,476
    const W = wins.length, L = losses.length;
    const k2 = W ? (S + Math.sqrt(S * S + 4 * 2561 * W * 2476 * L)) / (2 * 2561 * W) : 0;
    const share = (list: number[], sum: number) => {
      const w = list.map(() => { const x = r(); return 0.25 + 1.9 * x * x; }); // mostly small, the odd big one
      const tot = w.reduce((a, b) => a + b, 0);
      list.forEach((i, j) => (pnl[i] = Math.round(((sum * w[j]) / tot) * 4) / 4));
    };
    if (W && L) {
      share(wins, 2561 * W * k2);
      share(losses, -(2476 * L) / k2);
    } else share(idx, S);
    // land exactly on the month total
    const diff = S - idx.reduce((a, i) => a + pnl[i], 0);
    pnl[idx[idx.length - 1]] += Math.round(diff * 100) / 100;
  }

  return dates.map((iso, i) => {
    const strike = Math.round((raw.equity.find((e) => e.date === iso)!.nifty + (r() - 0.5) * 40) / 50) * 50;
    const exitEarly = pnl[i] < 0 && r() < 0.55;
    const exit = exitEarly ? `${10 + Math.floor(r() * 4)}:${String(Math.floor(r() * 60)).padStart(2, '0')}` : '15:15';
    const ceEntry = Math.round((95 + r() * 60) * 20) / 20;
    const peEntry = Math.round((60 + r() * 40) * 20) / 20;
    const qty = raw.setup.lotQty;
    // split the trade's P&L over its two legs
    const ceP = Math.round((pnl[i] * (0.2 + r() * 0.6) - (r() - 0.5) * 1500) * 4) / 4;
    const peP = Math.round((pnl[i] - ceP) * 100) / 100;
    const leg = (type: 'CE' | 'PE', entryPrice: number, legPnl: number): Leg => ({
      type, strike, side: 'Sell', qty, entryPrice, exitPrice: Math.max(0.05, Math.round((entryPrice - legPnl / qty) * 20) / 20),
      exitTime: legPnl < 0 && exitEarly ? exit : '15:15', pnl: legPnl,
    });
    return {
      n: realTrades.length + i + 1, date: isoToLabel(iso), iso, entry: '09:17', exit,
      vix: Math.round(vixes[i] * 100) / 100, pnl: pnl[i], legs: [leg('CE', ceEntry, ceP), leg('PE', peEntry, peP)],
    };
  });
}

/** All 246 trades: the 10 real ones, then the seeded ones. */
export const ALL_TRADES: Trade[] = [...realTrades, ...generateTrades()];
const NIFTY = new Map(raw.equity.map((e) => [e.date, e.nifty]));

/* ── Recalculate everything from a list of trades ──────────────── */

export function computeStats(trades: Trade[]): Stats {
  const n = trades.length;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const profit = trades.reduce((a, t) => a + t.pnl, 0);
  const avgwin = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgloss = losses.length ? losses.reduce((a, t) => a + t.pnl, 0) / losses.length : 0;
  let cum = 0, peak = 0, peakDate = trades[0]?.iso ?? '', mdd = 0, from = '', to = '', ddTrades = 0;
  let ws = 0, ls = 0, wstreak = 0, lstreak = 0;
  for (const t of trades) {
    if (cum < peak) ddTrades++; // taken while below the previous high
    cum += t.pnl;
    if (cum > peak) { peak = cum; peakDate = t.iso; }
    if (cum - peak < mdd) { mdd = cum - peak; from = peakDate; to = t.iso; }
    if (t.pnl > 0) { ws++; ls = 0; } else { ls++; ws = 0; }
    wstreak = Math.max(wstreak, ws);
    lstreak = Math.max(lstreak, ls);
  }
  const avg = n ? profit / n : 0;
  const rr = avgloss ? avgwin / Math.abs(avgloss) : 0;
  return {
    profit, trades: n, avg, win: n ? (wins.length / n) * 100 : 0, loss: n ? (losses.length / n) * 100 : 0,
    avgwin, avgloss, maxwin: Math.max(0, ...trades.map((t) => t.pnl)), maxloss: Math.min(0, ...trades.map((t) => t.pnl)),
    mdd, mdd_days: from ? dayDiff(from, to) : 0, mdd_from: from ? isoToLabel(from) : '–', mdd_to: to ? isoToLabel(to) : '–',
    ret_dd: mdd ? profit / Math.abs(mdd) : 0, rr, exp: avgloss ? avg / Math.abs(avgloss) : 0,
    wstreak, lstreak, dd_trades: ddTrades, wins: wins.length,
  };
}

export function computeEquity(trades: Trade[]): EquityPoint[] {
  let cum = 0, peak = 0;
  return trades.map((t) => {
    cum += t.pnl;
    peak = Math.max(peak, cum);
    return { date: t.iso, cumPnl: Math.round(cum * 100) / 100, drawdown: Math.round((cum - peak) * 100) / 100, nifty: NIFTY.get(t.iso) ?? 0, dayPnl: t.pnl };
  });
}

export function computeYearWise(trades: Trade[]): YearRow[] {
  const years = [...new Set(ALL_TRADES.map((t) => Number(t.iso.slice(0, 4))))];
  return years.map((year) => {
    const ts = trades.filter((t) => t.iso.startsWith(String(year)));
    const months = MONTHS.map((_, m) => {
      const mt = ts.filter((t) => Number(t.iso.slice(5, 7)) === m + 1);
      return mt.length ? Math.round(mt.reduce((a, t) => a + t.pnl, 0)) : null;
    });
    return { year, months, total: Math.round(ts.reduce((a, t) => a + t.pnl, 0)), maxDrawdown: Math.round(computeStats(ts).mdd) };
  });
}

export function monthInfo(trades: Trade[], year: number, month: number): MonthInfo {
  const mt = trades.filter((t) => t.iso.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
  return { trades: mt.length, winRate: mt.length ? Math.round((mt.filter((t) => t.pnl > 0).length / mt.length) * 100) : 0 };
}

/* ── The view: exact real figures when unfiltered, recalculated otherwise ── */

export interface ResultsView {
  trades: Trade[];
  stats: Stats;
  equity: EquityPoint[];
  yearWise: YearRow[];
  from: string;
  to: string;
  /** the real run as it is (no filter, no variant): show the JSON's own figures */
  exact: boolean;
}

export function resultsView(opts: { vix?: [number, number] | null; until?: string | null; variant?: number } = {}): ResultsView {
  const { vix, until, variant = 0 } = opts;
  // a different setup = a different (seeded) result from the same days
  let trades = variant ? vary(ALL_TRADES, variant) : ALL_TRADES;
  if (until) trades = trades.filter((t) => t.iso <= until);
  if (vix) trades = trades.filter((t) => t.vix >= vix[0] && t.vix <= vix[1]);
  const exact = !variant && !until && !vix;
  const realStats = { ...raw.stats, wins: Math.round((raw.stats.win / 100) * raw.stats.trades) } as Stats;
  return {
    trades,
    stats: exact ? realStats : computeStats(trades),
    equity: exact ? raw.equity : computeEquity(trades),
    yearWise: exact ? Object.entries(raw.yearWise).map(([y, v]) => ({ year: Number(y), ...v })) : computeYearWise(trades),
    from: SETUP.period.from,
    to: until ?? SETUP.period.to,
    exact,
  };
}

function vary(trades: Trade[], seed: number): Trade[] {
  const r = rng(seed);
  const scale = 0.7 + r() * 0.7;
  const shift = (r() - 0.35) * 420;
  return trades.map((t) => {
    const pnl = Math.round((t.pnl * scale + shift + (r() - 0.5) * 300) * 4) / 4;
    const k = t.pnl ? pnl / t.pnl : 1;
    return { ...t, pnl, legs: t.legs.map((l) => ({ ...l, pnl: Math.round(l.pnl * k * 4) / 4 })) };
  });
}

/* ── Robustness ────────────────────────────────────────────────── */

/** Max drawdown of each of `sims` reshuffles; calls back with progress. */
export async function monteCarlo(trades: Trade[], sims: number, onProgress: (done: number) => void, signal?: { cancelled: boolean }) {
  const r = rng(trades.length * 7919);
  const pnl = trades.map((t) => t.pnl);
  const out: number[] = [];
  const chunk = 400;
  for (let s = 0; s < sims; s += chunk) {
    if (signal?.cancelled) return null;
    for (let k = s; k < Math.min(sims, s + chunk); k++) {
      for (let i = pnl.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [pnl[i], pnl[j]] = [pnl[j], pnl[i]];
      }
      let cum = 0, peak = 0, mdd = 0;
      for (const p of pnl) {
        cum += p;
        if (cum > peak) peak = cum;
        if (cum - peak < mdd) mdd = cum - peak;
      }
      out.push(mdd);
    }
    onProgress(Math.min(sims, s + chunk));
    await new Promise((res) => setTimeout(res, 16)); // let the progress bar draw
  }
  return out.sort((a, b) => a - b); // deepest first
}

/** The drawdown that `confidence`% of simulations stay above. */
export const atConfidence = (sorted: number[], confidence: number) => sorted[Math.floor(((100 - confidence) / 100) * (sorted.length - 1))];

export interface SampleRow {
  netPnl: number;
  winRate: number;
  maxDrawdown: number;
  expectancy: number;
}

export function inOutSample(trades: Trade[], split: number) {
  const cut = Math.round(trades.length * split);
  const part = (ts: Trade[]): SampleRow => {
    const s = computeStats(ts);
    return { netPnl: s.profit, winRate: s.win, maxDrawdown: s.mdd, expectancy: s.exp };
  };
  const inS = trades.slice(0, cut);
  const outS = trades.slice(cut);
  return {
    in: part(inS),
    out: part(outS),
    inRange: inS.length ? `${isoToLabel(inS[0].iso)} – ${isoToLabel(inS[inS.length - 1].iso)}` : '–',
    outRange: outS.length ? `${isoToLabel(outS[0].iso)} – ${isoToLabel(outS[outS.length - 1].iso)}` : '–',
    splitDate: outS[0]?.iso ?? null,
  };
}

/** One plain sentence on whether the second half holds up. */
export function sampleVerdict(i: SampleRow, o: SampleRow) {
  const similar = Math.abs(i.winRate - o.winRate) < 5 && Math.sign(i.netPnl) === Math.sign(o.netPnl);
  if (similar && i.netPnl < 0) return 'Out-of-sample behaves like in-sample: no sign of curve-fitting, but both lose money.';
  if (similar) return 'Out-of-sample holds up: the result is less likely to be curve-fitted.';
  if (o.netPnl < i.netPnl) return 'Out-of-sample is clearly worse than in-sample: the strategy may be tuned to the first part of the data.';
  return 'Out-of-sample is better than in-sample: encouraging, but check it over a longer period.';
}

/** Short Straddle shows the real run; any other setup gets its own seeded result from the same days. */
export function variantFor(setupName: string) {
  if (setupName === 'Short Straddle') return 0;
  let h = 7;
  for (const c of setupName) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h || 1;
}

/** Copilot's one plain sentence about a result, plus three follow-ups. */
export function copilotTake(view: ResultsView, variant: number) {
  if (!variant)
    return {
      insight: 'Losses come from trending months (Nov, Jan, May, Jul): one leg hits its stop early and the other can’t make it back. April and October, the range-bound months, carry the profit.',
      chips: ['Skip trending days', 'Try a wider stop loss', 'Why is April so good?'],
    };
  const cells = view.yearWise.flatMap((y) => y.months.map((v, m) => ({ v, m }))).filter((c): c is { v: number; m: number } => c.v !== null);
  const worst = [...cells].sort((a, b) => a.v - b.v).slice(0, 3).map((c) => MONTHS[c.m]);
  const best = [...cells].sort((a, b) => b.v - a.v).slice(0, 2).map((c) => FULL_MONTHS[c.m]);
  return {
    insight: `Most of the losses sit in ${worst.join(', ')}; ${best.join(' and ')} carry the profit. ${view.stats.profit >= 0 ? 'It makes money overall, but the deep months decide the drawdown.' : 'Overall it loses money, so look at what those losing months have in common.'}`,
    chips: ['Skip trending days', 'Try a wider stop loss', `Why is ${best[0]} so good?`],
  };
}

export const MONTE_CARLO = raw.monteCarlo;
export const IN_OUT = raw.inOutSample;
