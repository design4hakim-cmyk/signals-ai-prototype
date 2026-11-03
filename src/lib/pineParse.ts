import { uid } from '@/lib/conditions';
import { indicatorDef } from '@/lib/indicators';
import { MA_FN } from '@/lib/pine';
import type { Condition, Group, IndicatorId, IndicatorParams, Logic, MathOp, Operand, Relation, Source, StrategyNode, StrategyTree, Timing } from '@/types/strategy';

/*
  Pine Script → canvas (design/pine-editor · Parsing). There's no real compiler: this reads
  the subset lib/pine.ts writes, and knows the mistakes the demo scripts make.
    • `name = ta.<fn>(src, n)` variables, `[bbMiddle, bbUpper, bbLower] = ta.bb(…)`
    • one `longOk = …` entry with and / or / not (…), brackets = a group
    • ta.crossover / ta.crossunder, > < >= <= == !=, numbers, `x * 1.5`, `rsi[1]`
    • one exit `if … → strategy.close`
  Each term either fits (a block), is custom logic (ta.lowest / highest / barssince → one grey
  block), or makes the whole strategy code only (var, :=, loops).
*/

export type ProblemKind = 'typo' | 'garbled' | 'bracket' | 'needs' | 'unsupported';

export interface FixOption {
  label: string;
  hint?: string;
  suggested?: boolean;
  /** the new text of the line (may hold several lines); null = no change ("I'll edit it") */
  line: string | null;
}

export interface Problem {
  id: string;
  kind: ProblemKind;
  line: number; // 1-based
  col: number; // 1-based, for "Error 15:27"
  /** the broken token, for the wavy underline (0-based, in the line) */
  from: number;
  to: number;
  /** exactly as the compiler would write it */
  message: string;
  /** one plain sentence; `code` in backticks becomes a grey code chip */
  explain: string;
  /** typo / garbled / bracket: one fix */
  fix?: { line: string; minus: string; plus: string };
  /** needs you: choices, never guessed */
  options?: FixOption[];
  /** what "Needs you" asks */
  question?: string;
}

export const TAG: Record<ProblemKind, string> = {
  typo: 'Typo', garbled: 'Garbled paste', bracket: 'Missing bracket', needs: 'Needs you', unsupported: 'Not supported yet',
};

export interface CompileOk {
  ok: true;
  tree: StrategyTree;
  timing: Record<'entry' | 'exit', Timing>;
  codeOnly: boolean;
  /** lines that became custom logic blocks */
  customLines: number[];
  /** the lines that use memory between candles (code only) */
  memoryLines: number[];
}
export interface CompileFail {
  ok: false;
  problems: Problem[];
}
export type CompileResult = CompileOk | CompileFail;

/* ── tokens ────────────────────────────────────────────────────── */

type Tok = { t: 'id' | 'num' | 'str' | 'op'; v: string; at: number };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\/\/.*$)|("[^"]*"|'[^']*')|(\d+(?:\.\d+)?)|([A-Za-z_][\w.]*)|(>=|<=|==|!=|:=|[()[\],=<>+\-*/?:]))/gy;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    const at = m.index + m[0].length - (m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').length;
    if (m[1]) break;
    if (m[2]) out.push({ t: 'str', v: m[2], at });
    else if (m[3]) out.push({ t: 'num', v: m[3], at });
    else if (m[4]) out.push({ t: 'id', v: m[4], at });
    else if (m[5]) out.push({ t: 'op', v: m[5], at });
    if (!m[0].length) break;
  }
  return out;
}

const stripComment = (l: string) => l.replace(/\/\/.*$/, '');

/* ── known names ───────────────────────────────────────────────── */

const BUILTINS = new Set([
  'close', 'open', 'high', 'low', 'volume', 'hlc3', 'hl2', 'ohlc4', 'true', 'false', 'na', 'and', 'or', 'not', 'if', 'else', 'var', 'for', 'while', 'to',
  'strategy', 'strategy.long', 'strategy.short', 'strategy.entry', 'strategy.close', 'barstate.isconfirmed', 'overlay',
]);
const FUNCS = new Set([
  'ta.ema', 'ta.sma', 'ta.wma', 'ta.rsi', 'ta.median', 'ta.stoch', 'ta.bb', 'ta.vwap', 'ta.crossover', 'ta.crossunder', 'ta.lowest', 'ta.highest', 'ta.barssince',
  'ta.change', 'trimmedMean', 'geoMean', 'harmonicMean', 'strategy', 'strategy.entry', 'strategy.close', 'input.int', 'input.float', 'request.security', 'math.abs',
]);
const TA_FNS = ['ema', 'sma', 'wma', 'rsi', 'median', 'stoch', 'bb', 'vwap', 'crossover', 'crossunder', 'lowest', 'highest', 'barssince', 'change'];
const ARGS = ['comment', 'qty', 'id', 'direction', 'when', 'alert_message', 'qty_percent', 'immediately', 'overlay', 'title', 'defval'];

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  return d[a.length][b.length];
}

/* ── 1 · problems (the known mistakes) ─────────────────────────── */

export interface CanvasHints {
  /** variable name → its length on the canvas, e.g. ema21 → 21 */
  lengths: Record<string, number>;
}

function declared(lines: string[]) {
  const names = new Set<string>();
  for (const raw of lines) {
    const l = stripComment(raw);
    const tuple = l.match(/^\s*\[([^\]]+)\]\s*=/);
    if (tuple) tuple[1].split(',').forEach((n) => names.add(n.trim()));
    const one = l.match(/^\s*(?:var\s+(?:\w+\s+)?)?([A-Za-z_]\w*)\s*:?=(?!=)/);
    if (one) names.add(one[1]);
  }
  return names;
}

export function findProblems(code: string, hints: CanvasHints = { lengths: {} }): Problem[] {
  const lines = code.split('\n');
  const names = declared(lines);
  const problems: Problem[] = [];
  const add = (p: Omit<Problem, 'id'>) => problems.push({ ...p, id: `${p.line}:${p.from}:${p.kind}` });

  lines.forEach((raw, i) => {
    const line = i + 1;
    const l = stripComment(raw);
    if (!l.trim()) return;

    // unbalanced brackets
    const opens = (l.match(/\(/g) ?? []).length;
    const closes = (l.match(/\)/g) ?? []).length;
    if (opens > closes) {
      const end = raw.trimEnd().length;
      const fixed = raw.trimEnd() + ')'.repeat(opens - closes);
      add({
        kind: 'bracket', line, col: end + 1, from: Math.max(0, end - 13), to: end,
        message: "Mismatched input 'end of line' expecting ')'",
        explain: 'A closing bracket is missing at the end of this line.',
        fix: { line: fixed, minus: raw.trim().split(/,\s*/).pop()!, plus: fixed.trim().split(/,\s*/).pop()! },
      });
    }

    // not supported yet: valid Pine, AlgoTest can't run it
    const sec = l.indexOf('request.security');
    if (sec >= 0) {
      const sym = l.match(/request\.security\(\s*"([^"]+)"/)?.[1] ?? 'another symbol';
      add({
        kind: 'unsupported', line, col: sec + 1, from: sec, to: sec + 'request.security'.length,
        message: 'request.security is not supported in AlgoTest yet',
        explain: `Line ${line} reads another symbol’s data (\`request.security\`). AlgoTest can’t use a second symbol inside one strategy yet. Your code itself is fine, and the rest can run.`,
        options: [
          { label: 'Rebuild with AI', hint: 'Use a close alternative AlgoTest supports. You review the diff first.', suggested: true, line: null },
          { label: 'Remove it and run', hint: `The ${sym} filter is dropped. Entries fire on the EMA cross only.`, line: '' },
          { label: 'Request this feature', hint: 'Sends your code to support. We’ll tell you when it’s possible.', line: null },
        ],
      });
      return;
    }

    for (const tok of tokenize(l)) {
      if (tok.t !== 'id') continue;
      const after = l.slice(tok.at + tok.v.length);
      const isCall = /^\s*\(/.test(after);
      const isNamedArg = /^\s*=(?!=)/.test(after) && /[(,]\s*$/.test(l.slice(0, tok.at));

      // a garbled namespace: tQNDa.ema(…)
      const dot = tok.v.indexOf('.');
      if (dot > 0 && isCall && !FUNCS.has(tok.v)) {
        const ns = tok.v.slice(0, dot);
        const fn = tok.v.slice(dot + 1);
        if (TA_FNS.includes(fn) && ns !== 'ta') {
          const fixed = raw.slice(0, tok.at) + 'ta' + raw.slice(tok.at + ns.length);
          add({
            kind: 'garbled', line, col: tok.at + 1, from: tok.at, to: tok.at + ns.length,
            message: `Could not find function or function reference '${tok.v}'`,
            explain: `\`${ns}\` looks like a broken paste. It should be \`ta\`, the built-in indicator library.`,
            fix: { line: fixed, minus: raw.trim().replace(/\s+/g, ' '), plus: fixed.trim().replace(/\s+/g, ' ') },
          });
        }
        continue;
      }

      // a named argument that doesn't exist: commCent='exit'
      if (isNamedArg) {
        if (!ARGS.includes(tok.v)) {
          const best = [...ARGS].sort((a, b) => distance(tok.v, a) - distance(tok.v, b))[0];
          const value = after.match(/^\s*=\s*('[^']*'|"[^"]*"|[\w.]+)/)?.[1] ?? '';
          const fixed = raw.slice(0, tok.at) + best + raw.slice(tok.at + tok.v.length);
          const fn = l.slice(0, tok.at).match(/([\w.]+)\([^()]*$/)?.[1] ?? 'this call';
          add({
            kind: 'typo', line, col: tok.at + 1, from: tok.at, to: tok.at + tok.v.length,
            message: `'${tok.v}' is not an argument`,
            explain: `\`${tok.v}\` isn’t an option for ${fn}. You probably meant \`${best}\`.`,
            fix: { line: fixed, minus: `${tok.v}=${value}`, plus: `${best}=${value}` },
          });
        }
        continue;
      }

      if (isCall || BUILTINS.has(tok.v) || names.has(tok.v) || FUNCS.has(tok.v) || dot > 0) continue;
      // `name =` on its own line declares it
      if (/^\s*=(?!=)/.test(after)) continue;

      // a garbled identifier: cWENMDlose → close
      const lower = tok.v.replace(/[A-Z]/g, '');
      if (tok.v.length - lower.length >= 3 && BUILTINS.has(lower)) {
        const fixed = raw.slice(0, tok.at) + lower + raw.slice(tok.at + tok.v.length);
        const call = l.slice(0, tok.at).match(/([\w.]+\()$/)?.[1] ?? '';
        add({
          kind: 'garbled', line, col: tok.at + 1, from: tok.at, to: tok.at + tok.v.length,
          message: `Undeclared identifier '${tok.v}'`,
          explain: `\`${tok.v}\` is \`${lower}\` with pasted letters inside it.`,
          fix: { line: fixed, minus: `${call}${tok.v}${after.match(/^[^)]*\)/)?.[0] ?? ''}`, plus: `${call}${lower}${after.match(/^[^)]*\)/)?.[0] ?? ''}` },
        });
        continue;
      }

      // never defined: ask, don't guess (it changes when trades fire)
      const target = l.match(/^\s*([A-Za-z_]\w*)\s*=/)?.[1];
      const lengthArg = /,\s*$/.test(l.slice(0, tok.at)) && /^\s*\)/.test(after);
      if (lengthArg && target) {
        const canvas = hints.lengths[target] ?? Number(target.match(/\d+$/)?.[0] ?? 21);
        add({
          kind: 'needs', line, col: tok.at + 1, from: tok.at, to: tok.at + tok.v.length,
          message: `Undeclared identifier '${tok.v}'`,
          question: `\`${tok.v}\` was never defined. Which ${target.replace(/\d+$/, '').toUpperCase()} length did you mean?`,
          explain: 'This changes when trades fire, so AI won’t pick for you.',
          options: [
            { label: `${canvas} · matches canvas`, suggested: true, line: raw.slice(0, tok.at) + canvas + raw.slice(tok.at + tok.v.length) },
            { label: 'Add an input', hint: `${tok.v} = input.int(${canvas}, "Length")`, line: `${tok.v} = input.int(${canvas}, "Length")\n${raw}` },
          ],
        });
      } else {
        const family = tok.v.replace(/[A-Z].*$/, '').replace(/\d+$/, '');
        // names of the same kind that this line doesn't already use
        const alike = [...names].filter((n) => n.startsWith(family) && n !== tok.v && /\d/.test(n) && !new RegExp(`\\b${n}\\b`).test(l));
        const choices = alike.length ? alike : [...names].filter((n) => /\d/.test(n));
        add({
          kind: 'needs', line, col: tok.at + 1, from: tok.at, to: tok.at + tok.v.length,
          message: `Undeclared identifier '${tok.v}'`,
          question: `\`${tok.v}\` doesn’t exist. ${/crossunder/.test(l) ? 'Exit on a cross under:' : 'Which one did you mean?'}`,
          explain: 'This changes when trades fire, so AI won’t pick for you.',
          options: choices.slice(0, 2).map((n, k) => ({
            label: k === 0 ? `${n} · matches canvas` : n, suggested: k === 0,
            line: raw.slice(0, tok.at) + n + raw.slice(tok.at + tok.v.length),
          })),
        });
      }
    }
  });

  // valid code that can never trade
  if (!problems.length && !/strategy\.entry\s*\(/.test(code)) {
    const i = lines.findIndex((l) => /^\s*longOk\s*=/.test(l));
    const line = (i < 0 ? lines.length : i + 1);
    add({
      kind: 'needs', line, col: 1, from: 0, to: 0,
      message: 'No strategy.entry call',
      question: 'There’s no `strategy.entry`, so the strategy never buys. Add one?',
      explain: 'This changes when trades fire, so AI won’t pick for you.',
      options: [
        { label: 'Add the entry back', suggested: true, line: `${lines[line - 1] ?? ''}\nif longOk and barstate.isconfirmed\n    strategy.entry("BUY", strategy.long)` },
        { label: 'I’ll write it', line: null },
      ],
    });
  }
  return problems.sort((a, b) => a.line - b.line);
}

/* ── 2 · parse (the subset pine.ts writes) ─────────────────────── */

const SOURCE: Record<string, Source> = { close: 'Close', open: 'Open', high: 'High', low: 'Low', volume: 'Volume' };
const MA_OF: Record<string, IndicatorId> = Object.fromEntries(Object.entries(MA_FN).map(([id, fn]) => [fn, id as IndicatorId]));
const op = (id: IndicatorId, p: IndicatorParams): Operand => ({ type: 'indicator', id, params: { ...indicatorDef(id).defaults, ...p } });

type VarDef = { kind: 'operand'; o: Operand } | { kind: 'bool'; expr: string; line: number };

/** Custom logic in plain words, from a small lookup. */
function customText(expr: string): string {
  const m = expr.match(/ta\.(lowest|highest)\(\s*(\w+)\s*,\s*(\d+)\s*\)\s*([<>]=?)\s*([\d.]+)/);
  if (m) return `${m[2].replace(/\d+$/, '').toUpperCase()} was ${m[4].startsWith('<') ? 'below' : 'above'} ${m[5]} in the last ${m[3]} candles`;
  const b = expr.match(/ta\.barssince\((.+)\)\s*([<>]=?)\s*(\d+)/);
  if (b) return `${b[1]} happened within the last ${b[3]} candles`;
  return expr;
}
const isCustomExpr = (e: string) => /ta\.(lowest|highest|barssince|valuewhen|change)\(/.test(e);

class Parser {
  i = 0;
  toks: Tok[];
  vars: Map<string, VarDef>;
  customLines: Set<number>;
  constructor(src: string, vars: Map<string, VarDef>, customLines: Set<number>) {
    this.toks = tokenize(src);
    this.vars = vars;
    this.customLines = customLines;
  }
  peek(v?: string) {
    const t = this.toks[this.i];
    return v === undefined ? t : t && t.v === v ? t : undefined;
  }
  take(v?: string) {
    const t = this.toks[this.i];
    if (v !== undefined && t?.v !== v) throw new Error(`expected ${v}`);
    this.i++;
    return t;
  }

  /** a node, or null for `false` (an empty group) */
  or(): Node {
    const items = [this.and()];
    while (this.peek('or')) { this.take(); items.push(this.and()); }
    return items.length > 1 ? { g: grp('OR', items.map(asChild)) } : items[0];
  }
  and(): Node {
    const items = [this.unary()];
    while (this.peek('and')) { this.take(); items.push(this.unary()); }
    if (items.length === 1) return items[0];
    if (items.every((x) => x.not)) return { g: grp('NONE', items.map((x) => asChild({ ...x, not: false }))) };
    return { g: grp('AND', items.map(asChild)) };
  }
  unary(): Node {
    if (this.peek('not')) {
      this.take();
      this.take('(');
      const inner = this.or();
      this.take(')');
      return { ...inner, not: true };
    }
    if (this.peek('(')) {
      this.take();
      const inner = this.or();
      this.take(')');
      // brackets are a group
      return { g: inner.g ?? grp('AND', inner.c ? [inner.c] : []) };
    }
    const t = this.peek();
    if (t?.v === 'false') { this.take(); return { empty: true }; }
    if (t?.v === 'ta.crossover' || t?.v === 'ta.crossunder') {
      this.take();
      this.take('(');
      const a = this.value();
      this.take(',');
      const b = this.value();
      this.take(')');
      return { c: mk(a, t.v === 'ta.crossover' ? 'Cross Above' : 'Cross Below', b) };
    }
    // a variable that holds a whole condition
    if (t?.t === 'id' && this.vars.get(t.v)?.kind === 'bool' && !/^(>|<|=|!)/.test(this.toks[this.i + 1]?.v ?? '')) {
      this.take();
      const def = this.vars.get(t.v) as Extract<VarDef, { kind: 'bool' }>;
      if (isCustomExpr(def.expr)) {
        this.customLines.add(def.line);
        return { c: { kind: 'cond', id: uid('c'), left: null, relation: null, right: null, custom: { text: customText(def.expr), name: t.v, expr: def.expr } } };
      }
      return new Parser(def.expr, this.vars, this.customLines).or();
    }
    const a = this.value();
    const rel = this.take()?.v;
    const b = this.value();
    const R: Record<string, Relation> = { '>': 'Greater Than', '>=': 'Greater Than or Equal', '<': 'Less Than', '<=': 'Less Than or Equal', '==': 'Equals', '!=': 'Not Equal' };
    if (!R[rel]) throw new Error(`unknown relation ${rel}`);
    return { c: mk(a, R[rel], b) };
  }

  value(): Operand {
    let o = this.base();
    if (this.peek('[')) {
      this.take();
      const n = Number(this.take().v);
      this.take(']');
      if (o.type === 'indicator') o = { ...o, params: { ...o.params, offset: n } };
    }
    const m = this.peek();
    if (m && ['*', '/', '+', '-'].includes(m.v)) {
      this.take();
      const value = Number(this.take().v);
      const opMap: Record<string, MathOp> = { '*': '×', '/': '÷', '+': '+', '-': '−' };
      o = { ...o, math: { op: opMap[m.v], value } };
    }
    return o;
  }
  base(): Operand {
    const t = this.take();
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num') return { type: 'number', value: Number(t.v) };
    if (t.v in SOURCE) return t.v === 'volume' ? op('volume', {}) : op('price', { source: SOURCE[t.v] });
    if (this.peek('(')) {
      // an inline call: ta.sma(volume, 20)
      const call = this.call(t.v);
      return call;
    }
    const v = this.vars.get(t.v);
    if (v?.kind === 'operand') return structuredClone(v.o);
    throw new Error(`unknown name ${t.v}`);
  }
  call(fn: string): Operand {
    this.take('(');
    const args: string[] = [];
    let depth = 0;
    let cur = '';
    while (this.peek() && !(depth === 0 && this.peek(')'))) {
      const t = this.take();
      if (t.v === '(') depth++;
      if (t.v === ')') depth--;
      if (depth === 0 && t.v === ',') { args.push(cur.trim()); cur = ''; } else cur += (cur && !/[(,]$/.test(cur) && t.v !== ')' && t.v !== '(' ? ' ' : '') + t.v;
    }
    args.push(cur.trim());
    this.take(')');
    const o = operandOfCall(fn, args);
    if (!o) throw new Error(`can't draw ${fn}`);
    return o;
  }
}

type Node = { c?: Condition; g?: Group; empty?: boolean; not?: boolean };
const grp = (logic: Logic, children: StrategyNode[]): Group => ({ kind: 'group', id: uid('g'), logic, children });
const asChild = (n: Node): StrategyNode => n.c ?? n.g ?? grp('AND', []);
const mk = (left: Operand, relation: Relation, right: Operand): Condition => ({ kind: 'cond', id: uid('c'), left, relation, right });

function operandOfCall(fn: string, args: string[]): Operand | null {
  if (fn in MA_OF) return op(MA_OF[fn], { length: Number(args[1]), source: SOURCE[args[0]] ?? 'Close' });
  if (fn === 'ta.rsi') return op('rsi', { length: Number(args[1]), source: SOURCE[args[0]] ?? 'Close' });
  if (fn === 'ta.vwap') return op('vwap', {});
  if (fn === 'ta.sma' && /ta\.stoch/.test(args[0])) {
    const k = Number(args[0].match(/(\d+)\s*\)?$/)?.[1] ?? 14);
    return op('stoch', { k, d: Number(args[1]) });
  }
  return null;
}

/** Read the variables: indicators become operands; boolean lines are kept as expressions. */
function readVars(lines: string[]): Map<string, VarDef> {
  const vars = new Map<string, VarDef>();
  lines.forEach((raw, i) => {
    const l = stripComment(raw).trim();
    const tuple = l.match(/^\[([^\]]+)\]\s*=\s*ta\.bb\(\s*(\w+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
    if (tuple) {
      const names = tuple[1].split(',').map((n) => n.trim());
      (['Middle', 'Upper', 'Lower'] as const).forEach((band, k) =>
        vars.set(names[k], { kind: 'operand', o: op('bb', { length: Number(tuple[3]), mult: Number(tuple[4]), band, source: SOURCE[tuple[2]] ?? 'Close' }) }));
      return;
    }
    const m = l.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/);
    if (!m || m[1] === 'longOk' || /^strategy\(/.test(l)) return;
    const [, name, rhs] = m;
    const call = rhs.match(/^([\w.]+)\((.*)\)$/);
    if (call && !/[<>=]/.test(rhs)) {
      const args = splitArgs(call[2]);
      if (call[1] === 'ta.sma' && /ta\.stoch/.test(args[0])) {
        const k = Number(args[0].match(/(\d+)\s*\)\s*$/)?.[1] ?? 14);
        vars.set(name, { kind: 'operand', o: op('stoch', { k, d: Number(args[1]) }) });
        return;
      }
      if (call[1] === 'ta.vwap') return vars.set(name, { kind: 'operand', o: op('vwap', {}) });
      const o = operandOfCall(call[1], args);
      if (o) vars.set(name, { kind: 'operand', o });
      return;
    }
    vars.set(name, { kind: 'bool', expr: rhs, line: i + 1 });
  });
  return vars;
}

function splitArgs(s: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const rootOf = (n: Node): Group => n.g ?? grp('AND', n.c ? [n.c] : []);

/** Code → canvas. Problems first; then code only; then the tree. */
export function compile(code: string, hints?: CanvasHints): CompileResult {
  const problems = findProblems(code, hints);
  if (problems.length) return { ok: false, problems };
  const lines = code.split('\n');

  // memory between candles: the canvas can't draw it
  const memoryLines = lines.map((l, i) => (/^\s*var\s|:=|^\s*(for|while)\b/.test(stripComment(l)) ? i + 1 : 0)).filter(Boolean);
  const timing = {
    entry: (/if\s+longOk\s+and\s+barstate\.isconfirmed/.test(code) || /barstate\.isconfirmed/.test(code) ? 'close' : 'during') as Timing,
    exit: 'close' as Timing,
  };
  if (memoryLines.length)
    return { ok: true, codeOnly: true, tree: { entry: grp('AND', []), exit: grp('AND', []) }, timing, customLines: [], memoryLines };

  const vars = readVars(lines);
  const customLines = new Set<number>();
  const entryLine = lines.find((l) => /^\s*longOk\s*=/.test(l));
  const entryExpr = entryLine
    ? stripComment(entryLine).replace(/^\s*longOk\s*=\s*/, '')
    : stripComment(lines.find((l, i) => /^\s*if\s/.test(l) && /strategy\.entry/.test(lines[i + 1] ?? '')) ?? 'if false').replace(/^\s*if\s+/, '').replace(/\s+and\s+barstate\.isconfirmed\s*$/, '');
  const exitIdx = lines.findIndex((l, i) => /^\s*if\s/.test(l) && /strategy\.close/.test(lines[i + 1] ?? ''));
  const exitExpr = exitIdx >= 0 ? stripComment(lines[exitIdx]).replace(/^\s*if\s+/, '').trim() : 'false';

  const entry = rootOf(new Parser(entryExpr.trim(), vars, customLines).or());
  const exit = rootOf(new Parser(exitExpr, vars, customLines).or());
  return { ok: true, codeOnly: false, tree: { entry, exit }, timing, customLines: [...customLines].sort(), memoryLines: [] };
}

/** Lines that hold memory between candles, as "5, 8–12" for the code-only card. */
export function lineRanges(ns: number[]) {
  const out: string[] = [];
  for (let i = 0; i < ns.length; i++) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
    out.push(i === j ? String(ns[i]) : `${ns[i]}–${ns[j]}`);
    i = j;
  }
  return out.join(', ');
}

/* ── 3 · comparing trees (Run: what changed on the canvas) ─────── */

/** The tree without ids and Copilot marks, defaults filled: two trees that trade the same look the same. */
export function shape(t: StrategyTree): unknown {
  const params = (o: Operand) =>
    o.type === 'number' ? { n: o.value, m: o.math } : { id: o.id, p: { ...indicatorDef(o.id).defaults, ...o.params, offset: o.params.offset || 0 }, m: o.math };
  const nodeShape = (n: StrategyNode): unknown =>
    n.kind === 'cond'
      ? n.custom ? { custom: n.custom.expr } : { l: n.left && params(n.left), r: n.relation, rt: n.right && params(n.right) }
      : { logic: n.children.length === 1 && n.logic !== 'NONE' ? 'AND' : n.logic, c: n.children.map(nodeShape) };
  return { entry: nodeShape(t.entry), exit: nodeShape(t.exit) };
}

export const sameTree = (a: StrategyTree, b: StrategyTree) => JSON.stringify(shape(a)) === JSON.stringify(shape(b));

/** "1 added, 1 changed" between two trees, by block position. */
export function treeDiff(before: StrategyTree, after: StrategyTree) {
  const flat = (t: StrategyTree) => {
    const out: string[] = [];
    const walk = (n: StrategyNode) => (n.kind === 'cond' ? out.push(JSON.stringify(nodeOnly(n))) : n.children.forEach(walk));
    walk(t.entry);
    walk(t.exit);
    return out;
  };
  const nodeOnly = (c: Condition) => (shape({ entry: { kind: 'group', id: '', logic: 'AND', children: [c] }, exit: { kind: 'group', id: '', logic: 'AND', children: [] } }) as { entry: unknown }).entry;
  const a = flat(before);
  const b = flat(after);
  const left = [...a];
  let same = 0;
  for (const x of b) {
    const k = left.indexOf(x);
    if (k >= 0) { left.splice(k, 1); same++; }
  }
  const changed = Math.min(left.length, b.length - same);
  return { added: b.length - same - changed, changed, removed: left.length - changed };
}
