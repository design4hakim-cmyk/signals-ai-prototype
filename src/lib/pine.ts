import type { Condition, Group, Operand, StrategyNode, StrategyTree } from '@/types/strategy';

/*
  Pine Script for the Copilot's code view, written from the canvas conditions.
  Mock, but readable: one variable per indicator, one line for entry and one for exit.
  The same tree always gives the same code, so "lines Copilot changed" = lines that are new.
*/

const src = (s?: string) => (s ?? 'Close').toLowerCase();

function expr(o: Operand, vars: Map<string, string>): string {
  if (o.type === 'number') return String(o.value);
  const p = o.params;
  let base: string;
  switch (o.id) {
    case 'price': base = src(p.source); break;
    case 'volume': base = 'volume'; break;
    case 'vwap': base = vwapVar(vars); break;
    default: base = variable(o, vars);
  }
  if (!o.math) return base;
  const op = { '+': '+', '−': '-', '×': '*', '÷': '/' }[o.math.op];
  return `${base} ${op} ${o.math.value}`;
}

function vwapVar(vars: Map<string, string>) {
  if (!vars.has('vwap')) vars.set('vwap', 'vwapLine = ta.vwap(hlc3)');
  return 'vwapLine';
}

function variable(o: Extract<Operand, { type: 'indicator' }>, vars: Map<string, string>): string {
  const p = o.params;
  const off = p.offset ? `[${p.offset}]` : '';
  const key = JSON.stringify([o.id, p]);
  const name = (() => {
    switch (o.id) {
      case 'ema': return `ema${p.length}`;
      case 'sma': return p.source === 'Volume' ? `volSma${p.length}` : `sma${p.length}`;
      case 'wma': return `wma${p.length}`;
      case 'rsi': return 'rsi';
      case 'stoch': return 'stochK';
      case 'bb': return `bb${p.band}`;
      default: return o.id;
    }
  })();
  const def = (() => {
    switch (o.id) {
      case 'ema': return `${name} = ta.ema(${src(p.source)}, ${p.length})`;
      case 'sma': return `${name} = ta.sma(${src(p.source)}, ${p.length})`;
      case 'wma': return `${name} = ta.wma(${src(p.source)}, ${p.length})`;
      case 'rsi': return `${name} = ta.rsi(${src(p.source)}, ${p.length})`;
      case 'stoch': return `${name} = ta.sma(ta.stoch(close, high, low, ${p.k}), ${p.d})`;
      case 'bb': return `[bbMiddle, bbUpper, bbLower] = ta.bb(${src(p.source)}, ${p.length}, ${p.mult})`;
      default: return `${name} = ta.sma(${src(p.source)}, ${p.length ?? 20})`;
    }
  })();
  if (![...vars.values()].includes(def)) vars.set(key, def);
  return name + off;
}

function cond(c: Condition, vars: Map<string, string>): string {
  if (c.custom) return `custom${c.custom.line}`;
  if (!c.left || !c.right || !c.relation) return 'false';
  const a = expr(c.left, vars);
  const b = expr(c.right, vars);
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

function group(g: Group, vars: Map<string, string>): string {
  const parts = g.children.map((ch: StrategyNode) => (ch.kind === 'cond' ? cond(ch, vars) : `(${group(ch, vars)})`));
  if (!parts.length) return 'false';
  if (g.logic === 'NONE') return parts.map((p) => `not (${p})`).join(' and ');
  return parts.join(g.logic === 'AND' ? ' and ' : ' or ');
}

/** The code, line by line. */
export function pineFor(t: StrategyTree, name: string, opts: { codeOnly?: boolean } = {}): string[] {
  if (opts.codeOnly)
    return [
      '//@version=5',
      `strategy("${name}", overlay=true)`,
      '',
      'rsi = ta.rsi(close, 14)',
      'var bool armed = false',
      '',
      '// Arm when RSI drops below 40',
      'if rsi < 40',
      '    armed := true',
      'if armed and ta.crossover(rsi, 70)',
      '    strategy.entry("BUY", strategy.long)',
      '    armed := false',
    ];
  const vars = new Map<string, string>();
  const entry = group(t.entry, vars);
  const exit = group(t.exit, vars);
  const customs = [t.entry, t.exit].flatMap(function walk(g: Group): Condition[] {
    return g.children.flatMap((ch) => (ch.kind === 'cond' ? (ch.custom ? [ch] : []) : walk(ch)));
  });
  return [
    '//@version=5',
    `strategy("${name}", overlay=true)`,
    '',
    ...vars.values(),
    ...customs.map((c) => `custom${c.custom!.line} = ta.lowest(rsi, 10) < 40 // ${c.custom!.text}`),
    '',
    '// Entry · on candle close',
    `longOk = ${entry}`,
    'if longOk and barstate.isconfirmed',
    '    strategy.entry("BUY", strategy.long)',
    '// Exit',
    `if ${exit}`,
    '    strategy.close("BUY")',
  ];
}

/** Lines (1-based) in `after` that weren't in `before`. */
export function changedLines(before: string[], after: string[]) {
  const had = new Set(before);
  return after.map((l, i) => (l.trim() && !had.has(l) ? i + 1 : 0)).filter(Boolean);
}
