import type { Candle } from '@/types/market';
import type { IndicatorId, IndicatorParams, MathStep, Operand, Relation, Source } from '@/types/strategy';

/*
  The indicator list (B02 picker) and the maths behind each one.
  Mock prices, real formulas: same inputs → same signals.
*/

export type IndicatorCategory = 'Trend' | 'Momentum' | 'Volume';

export interface IndicatorDef {
  id: IndicatorId;
  name: string; // full name in the picker
  short: string; // name on the block
  category: IndicatorCategory;
  defaults: IndicatorParams;
}

export const INDICATORS: IndicatorDef[] = [
  { id: 'ema', name: 'Exponential Moving Average', short: 'EMA', category: 'Trend', defaults: { length: 9, source: 'Close', offset: 0 } },
  { id: 'sma', name: 'Simple Moving Average', short: 'MA', category: 'Trend', defaults: { length: 50, source: 'Close', offset: 0 } },
  { id: 'rsi', name: 'Relative Strength Index', short: 'RSI', category: 'Momentum', defaults: { length: 14, source: 'Close' } },
  { id: 'wma', name: 'Weighted Moving Average', short: 'WMA', category: 'Trend', defaults: { length: 20, source: 'Close', offset: 0 } },
  { id: 'bb', name: 'Bollinger Bands', short: 'Bollinger Band', category: 'Trend', defaults: { length: 20, mult: 2, band: 'Upper', source: 'Close' } },
  { id: 'stoch', name: 'Stochastic Oscillator', short: 'Stochastic', category: 'Momentum', defaults: { k: 14, d: 3 } },
  { id: 'price', name: 'Price', short: 'Close', category: 'Trend', defaults: { source: 'Close' } },
  { id: 'volume', name: 'Volume', short: 'Volume', category: 'Volume', defaults: {} },
  { id: 'vwap', name: 'Volume Weighted Average Price', short: 'VWAP', category: 'Volume', defaults: {} },
  { id: 'median', name: 'Median Average', short: 'Median', category: 'Trend', defaults: { length: 20, source: 'Close', offset: 0 } },
  { id: 'trimmed', name: 'Trimmed Mean', short: 'Trimmed Mean', category: 'Trend', defaults: { length: 20, source: 'Close', offset: 0 } },
  { id: 'geo', name: 'Geometric Mean', short: 'Geometric Mean', category: 'Trend', defaults: { length: 20, source: 'Close', offset: 0 } },
  { id: 'harmonic', name: 'Harmonic Mean', short: 'Harmonic Mean', category: 'Trend', defaults: { length: 20, source: 'Close', offset: 0 } },
];

export const indicatorDef = (id: IndicatorId) => INDICATORS.find((d) => d.id === id)!;

/** Two groups so crosses aren't lost among comparisons (behaviour sheet §1). */
export const RELATION_GROUPS: { label: string; items: Relation[] }[] = [
  { label: 'Compare', items: ['Greater Than', 'Greater Than or Equal', 'Less Than', 'Less Than or Equal', 'Equals', 'Not Equal'] },
  { label: 'Cross', items: ['Cross Above', 'Cross Below'] },
];

export const MATH_OPS: MathStep['op'][] = ['+', '−', '×', '÷'];

/* ── Labels on the block ───────────────────────────────────────── */

/** "EMA" and "(9, Close)" — name and settings are separate click targets (E02, E03). */
export function operandLabel(o: Operand): { name: string; args: string } {
  if (o.type === 'number') return { name: fmtNum(o.value), args: '' };
  const p = o.params;
  const off = p.offset ? `, offset ${p.offset}` : '';
  switch (o.id) {
    case 'price':
      return { name: p.source ?? 'Close', args: '' };
    case 'volume':
      return { name: 'Volume', args: '' };
    case 'vwap':
      return { name: 'VWAP', args: '' };
    case 'rsi':
      return { name: 'RSI', args: `(${p.length}${off})` };
    case 'stoch':
      return { name: 'Stochastic', args: `(${p.k}, ${p.d})` };
    case 'bb':
      return { name: 'Bollinger Band', args: `(${p.length}, ${p.mult}) · ${p.band}` };
    default:
      return { name: indicatorDef(o.id).short, args: `(${p.length}, ${p.source}${off})` };
  }
}

export const mathLabel = (m: MathStep) => `${m.op} ${fmtNum(m.value)}`;

export const fmtNum = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** Plain words for toasts and change descriptions: "RSI (14) Greater Than 50" */
export function operandText(o: Operand | null) {
  if (!o) return '…';
  const { name, args } = operandLabel(o);
  return [name, args, o.math ? mathLabel(o.math) : ''].filter(Boolean).join(' ');
}

/** Which settings the Inputs tab shows for an indicator (B03). */
export function inputFields(id: IndicatorId): (keyof IndicatorParams)[] {
  switch (id) {
    case 'price':
      return ['source'];
    case 'volume':
    case 'vwap':
      return [];
    case 'rsi':
      return ['length', 'source', 'offset'];
    case 'stoch':
      return ['k', 'd'];
    case 'bb':
      return ['length', 'mult', 'band', 'source'];
    default:
      return ['length', 'source', 'offset'];
  }
}

/* ── Maths ─────────────────────────────────────────────────────── */

/** Mock candles carry no volume, so we derive a steady one from each candle's range. */
function volumeOf(c: Candle, i: number) {
  const range = (c.high - c.low) / c.close;
  return Math.round(80_000 + range * 40_000_000 + ((i * 7919) % 97) * 900);
}

function sourceSeries(candles: Candle[], s: Source = 'Close') {
  if (s === 'Volume') return candles.map(volumeOf);
  const k = s.toLowerCase() as 'close' | 'open' | 'high' | 'low';
  return candles.map((c) => c[k]);
}

const rolling = (v: number[], n: number, f: (w: number[]) => number) =>
  v.map((_, i) => (i + 1 < n ? NaN : f(v.slice(i + 1 - n, i + 1))));

const mean = (w: number[]) => w.reduce((a, b) => a + b, 0) / w.length;

function ema(v: number[], n: number) {
  const k = 2 / (n + 1);
  const out: number[] = [];
  v.forEach((x, i) => out.push(i === 0 ? x : x * k + out[i - 1] * (1 - k)));
  return out;
}

function rsi(v: number[], n: number) {
  const out: number[] = [NaN];
  let up = 0;
  let down = 0;
  for (let i = 1; i < v.length; i++) {
    const ch = v[i] - v[i - 1];
    up = (up * (n - 1) + Math.max(ch, 0)) / n;
    down = (down * (n - 1) + Math.max(-ch, 0)) / n;
    out.push(i < n ? NaN : down === 0 ? 100 : 100 - 100 / (1 + up / down));
  }
  return out;
}

const shift = (v: number[], n = 0) => (n ? v.map((_, i) => v[i - n] ?? NaN) : v);

function indicatorSeries(candles: Candle[], id: IndicatorId, p: IndicatorParams): number[] {
  const n = Math.max(1, p.length ?? 14);
  const src = sourceSeries(candles, p.source);
  switch (id) {
    case 'price':
      return src;
    case 'volume':
      return sourceSeries(candles, 'Volume');
    case 'vwap': {
      // resets each day: Σ(typical price × volume) ÷ Σ volume
      const vol = sourceSeries(candles, 'Volume');
      let day = -1, pv = 0, vv = 0;
      return candles.map((c, i) => {
        const d = Math.floor(c.time / 86400);
        if (d !== day) { day = d; pv = 0; vv = 0; }
        pv += ((c.high + c.low + c.close) / 3) * vol[i];
        vv += vol[i];
        return pv / vv;
      });
    }
    case 'sma':
      return shift(rolling(src, n, mean), p.offset);
    case 'ema':
      return shift(ema(src, n), p.offset);
    case 'wma':
      return shift(rolling(src, n, (w) => w.reduce((a, x, i) => a + x * (i + 1), 0) / ((n * (n + 1)) / 2)), p.offset);
    case 'median':
      return shift(rolling(src, n, (w) => [...w].sort((a, b) => a - b)[Math.floor(n / 2)]), p.offset);
    case 'trimmed':
      return shift(rolling(src, n, (w) => { const s = [...w].sort((a, b) => a - b); const cut = Math.floor(n * 0.1); return mean(s.slice(cut, n - cut)); }), p.offset);
    case 'geo':
      return shift(rolling(src, n, (w) => Math.exp(mean(w.map(Math.log)))), p.offset);
    case 'harmonic':
      return shift(rolling(src, n, (w) => n / w.reduce((a, x) => a + 1 / x, 0)), p.offset);
    case 'bb': {
      const mid = rolling(src, n, mean);
      const sd = rolling(src, n, (w) => { const m = mean(w); return Math.sqrt(mean(w.map((x) => (x - m) ** 2))); });
      const k = p.band === 'Upper' ? 1 : p.band === 'Lower' ? -1 : 0;
      return mid.map((m, i) => m + k * (p.mult ?? 2) * sd[i]);
    }
    case 'rsi':
      return shift(rsi(src, n), p.offset);
    case 'stoch': {
      const kLen = p.k ?? 14;
      const raw = candles.map((c, i) => {
        if (i + 1 < kLen) return NaN;
        const w = candles.slice(i + 1 - kLen, i + 1);
        const hi = Math.max(...w.map((x) => x.high));
        const lo = Math.min(...w.map((x) => x.low));
        return hi === lo ? 50 : ((c.close - lo) / (hi - lo)) * 100;
      });
      return rolling(raw, p.d ?? 3, mean);
    }
  }
}

function applyMath(v: number[], m?: MathStep) {
  if (!m) return v;
  const f: Record<MathStep['op'], (x: number) => number> = {
    '+': (x) => x + m.value,
    '−': (x) => x - m.value,
    '×': (x) => x * m.value,
    '÷': (x) => (m.value === 0 ? NaN : x / m.value),
  };
  return v.map(f[m.op]);
}

/** One number per candle for a side of a condition. */
export function operandSeries(candles: Candle[], o: Operand): number[] {
  const base = o.type === 'number' ? candles.map(() => o.value) : indicatorSeries(candles, o.id, o.params);
  return applyMath(base, o.math);
}
