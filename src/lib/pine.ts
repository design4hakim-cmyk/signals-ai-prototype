import type { Condition, Group, Operand, StrategyNode, StrategyTree, Timing } from '@/types/strategy';

/*
  Canvas → Pine Script (design/pine-editor · sync model). The code is written straight
  from the canvas: one variable per indicator, one `longOk = …` line for the entry and one
  exit `if`. All of → `and`, Any of → `or`, None of → `not (…)`; a group inside a group is
  wrapped in brackets. The same tree always gives the same code, so lib/pineParse.ts can
  read it back (parse(pine(tree)) = tree).
*/

export interface PineOptions {
  timing?: Record<'entry' | 'exit', Timing>;
}

const SRC: Record<string, string> = { Close: 'close', Open: 'open', High: 'high', Low: 'low', Volume: 'volume' };
const src = (s?: string) => SRC[s ?? 'Close'] ?? 'close';
const suffix = (s?: string) => (!s || s === 'Close' ? '' : s);

/** Function per moving-average kind. The mock "means" are written as helper calls the parser knows. */
export const MA_FN: Record<string, string> = {
  sma: 'ta.sma', ema: 'ta.ema', wma: 'ta.wma', median: 'ta.median', trimmed: 'trimmedMean', geo: 'geoMean', harmonic: 'harmonicMean',
};
const MA_NAME: Record<string, string> = { sma: 'sma', ema: 'ema', wma: 'wma', median: 'median', trimmed: 'trimmed', geo: 'geo', harmonic: 'harmonic' };

interface Vars {
  /** name → definition line (without the aligned "=") */
  defs: Map<string, string>;
}

const MATH: Record<string, string> = { '+': '+', '−': '-', '×': '*', '÷': '/' };

function variable(o: Extract<Operand, { type: 'indicator' }>, v: Vars): string {
  const p = o.params;
  let name: string;
  let def: string;
  if (o.id in MA_FN) {
    name = p.source === 'Volume' ? `vol${MA_NAME[o.id][0].toUpperCase()}${MA_NAME[o.id].slice(1)}${p.length}` : `${MA_NAME[o.id]}${p.length}${suffix(p.source)}`;
    def = `${MA_FN[o.id]}(${src(p.source)}, ${p.length})`;
  } else if (o.id === 'rsi') {
    name = `rsi${p.length === 14 ? '' : p.length}${suffix(p.source)}`;
    def = `ta.rsi(${src(p.source)}, ${p.length})`;
  } else if (o.id === 'stoch') {
    name = p.k === 14 && p.d === 3 ? 'stochK' : `stochK${p.k}_${p.d}`;
    def = `ta.sma(ta.stoch(close, high, low, ${p.k}), ${p.d})`;
  } else if (o.id === 'bb') {
    const tag = p.length === 20 && p.mult === 2 && (p.source ?? 'Close') === 'Close' ? '' : `${p.length}_${String(p.mult).replace('.', 'p')}${suffix(p.source)}`;
    const names = ['Middle', 'Upper', 'Lower'].map((b) => `bb${b}${tag}`);
    name = `bb${p.band}${tag}`;
    // three outputs from one call: one tuple line
    const key = `[${names.join(', ')}]`;
    if (!v.defs.has(key)) v.defs.set(key, `ta.bb(${src(p.source)}, ${p.length}, ${p.mult})`);
    return name + (p.offset ? `[${p.offset}]` : '');
  } else {
    name = o.id;
    def = `ta.sma(close, 20)`;
  }
  if (!v.defs.has(name)) v.defs.set(name, def);
  return name + (p.offset ? `[${p.offset}]` : '');
}

function expr(o: Operand, v: Vars): string {
  let base: string;
  if (o.type === 'number') base = String(o.value);
  else if (o.id === 'price') base = src(o.params.source) + (o.params.offset ? `[${o.params.offset}]` : '');
  else if (o.id === 'volume') base = 'volume';
  else if (o.id === 'vwap') {
    if (!v.defs.has('vwapLine')) v.defs.set('vwapLine', 'ta.vwap(hlc3)');
    base = 'vwapLine';
  } else base = variable(o, v);
  return o.math ? `${base} ${MATH[o.math.op]} ${o.math.value}` : base;
}

function cond(c: Condition, v: Vars): string {
  if (c.custom) {
    if (!v.defs.has(c.custom.name)) v.defs.set(c.custom.name, c.custom.expr);
    return c.custom.name;
  }
  if (!c.left || !c.right || !c.relation) return 'false';
  const a = expr(c.left, v);
  const b = expr(c.right, v);
  switch (c.relation) {
    case 'Cross Above': return `ta.crossover(${a}, ${b})`;
    case 'Cross Below': return `ta.crossunder(${a}, ${b})`;
    case 'Greater Than': return `${a} > ${b}`;
    case 'Greater Than or Equal': return `${a} >= ${b}`;
    case 'Less Than': return `${a} < ${b}`;
    case 'Less Than or Equal': return `${a} <= ${b}`;
    case 'Equals': return `${a} == ${b}`;
    case 'Not Equal': return `${a} != ${b}`;
  }
}

function node(n: StrategyNode, v: Vars): string {
  return n.kind === 'cond' ? cond(n, v) : `(${group(n, v)})`;
}

function group(g: Group, v: Vars): string {
  const parts = g.children.map((ch) => node(ch, v));
  if (!parts.length) return 'false';
  // always `not (…)`: a group inside keeps its own brackets, so `not ((a or b))` reads back as a group
  if (g.logic === 'NONE') return parts.map((p) => `not (${p})`).join(' and ');
  return parts.join(g.logic === 'AND' ? ' and ' : ' or ');
}

/** Variables first, names aligned like the boards ("ema9  = …", "rsi   = …"). */
function defLines(v: Vars): string[] {
  const width = Math.max(0, ...[...v.defs.keys()].filter((k) => !k.startsWith('[')).map((k) => k.length));
  return [...v.defs].map(([k, d]) => (k.startsWith('[') ? `${k} = ${d}` : `${k.padEnd(width)} = ${d}`));
}

/** The code, line by line. */
export function pineFor(t: StrategyTree, name: string, opts: PineOptions = {}): string[] {
  const v: Vars = { defs: new Map() };
  const entry = group(t.entry, v);
  const exit = group(t.exit, v);
  const timing = opts.timing ?? { entry: 'close', exit: 'close' };
  return [
    '//@version=5',
    `strategy("${name}", overlay=true)`,
    '',
    ...defLines(v),
    '',
    `// Entry · ${timing.entry === 'close' ? 'on candle close' : 'during the candle'}`,
    `longOk = ${entry}`,
    timing.entry === 'close' ? 'if longOk and barstate.isconfirmed' : 'if longOk',
    '    strategy.entry("BUY", strategy.long)',
    '',
    '// Exit',
    `if ${exit}`,
    '    strategy.close("BUY")',
  ];
}

export const pineText = (t: StrategyTree, name: string, opts?: PineOptions) => pineFor(t, name, opts).join('\n');

/** The 1-based line where a custom logic variable is written. */
export function lineOfVar(lines: string[], name: string): number {
  const i = lines.findIndex((l) => new RegExp(`^${name}\\s*=`).test(l));
  return i + 1;
}

/** Lines (1-based) in `after` that weren't in `before`. */
export function changedLines(before: string[], after: string[]) {
  const had = new Set(before);
  return after.map((l, i) => (l.trim() && !had.has(l) ? i + 1 : 0)).filter(Boolean);
}
