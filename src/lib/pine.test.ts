import { describe, expect, it } from 'vitest';
import { cond, complexStrategy, demoStrategy, group, groupedStrategy, ind, num } from '@/mock/strategies';
import { BROKEN_5, CODE_ONLY, NO_ENTRY, NOT_SUPPORTED, ONE_TYPO, PARTLY_FITS, UNDEFINED_LEN } from '@/mock/pine';
import type { StrategyTree } from '@/types/strategy';
import { patchCode } from './lineDiff';
import { pineText } from './pine';
import { compile, findProblems, shape } from './pineParse';

/* design/pine-editor · Parsing: parse(pine(tree)) must equal tree. */

const roundTrip = (t: StrategyTree) => {
  const r = compile(pineText(t, 'Test'));
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join('; '));
  return r.tree;
};

const trees: [string, () => StrategyTree][] = [
  ['demo (EMA cross + RSI)', demoStrategy],
  ['grouped (Any of inside All of)', groupedStrategy],
  ['complex', complexStrategy],
  ['None of', () => ({ entry: group('NONE', [cond(ind('rsi'), 'Greater Than', num(70)), group('OR', [cond(ind('price'), 'Less Than', ind('sma', { length: 50 })), cond(ind('stoch'), 'Cross Below', num(80))])]), exit: group('AND', []) })],
  ['Any of at the top', () => ({ entry: group('OR', [cond(ind('ema', { length: 9 }), 'Cross Above', ind('ema', { length: 21 })), cond(ind('rsi', { length: 7 }), 'Less Than', num(30))]), exit: group('AND', [cond(ind('rsi'), 'Greater Than or Equal', num(60))]) })],
  ['volume × 1.5, Bollinger, VWAP, offsets', () => ({
    entry: group('AND', [
      cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' }, { op: '×', value: 1.5 })),
      cond(ind('price'), 'Cross Above', ind('bb', { band: 'Upper' })),
      cond(ind('price'), 'Greater Than', ind('vwap')),
      cond(ind('rsi', { offset: 1 }), 'Less Than', num(40)),
      cond(ind('price', { source: 'High' }), 'Greater Than or Equal', ind('wma', { length: 30, source: 'High' })),
    ]),
    exit: group('AND', [cond(ind('price'), 'Cross Below', ind('bb', { band: 'Middle' }))]),
  })],
  ['custom logic', () => ({
    entry: group('AND', [cond(ind('rsi'), 'Cross Above', num(60)), { ...cond(null, null, null), custom: { text: 'RSI was below 40 in the last 10 candles', name: 'dipped', expr: 'ta.lowest(rsi, 10) < 40' } }]),
    exit: group('AND', [cond(ind('rsi'), 'Less Than', num(50))]),
  })],
];

describe('Pine Script round trip', () => {
  for (const [name, make] of trees) {
    it(name, () => {
      const t = make();
      expect(shape(roundTrip(t))).toEqual(shape(t));
    });
  }
});

describe('Pine Script problems (demo scripts)', () => {
  it('1A · one typo', () => {
    const p = findProblems(ONE_TYPO);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kind: 'typo', line: 15, col: 27, message: "'commCent' is not an argument" });
    expect(p[0].fix?.plus).toBe("comment='exit'");
  });
  it('1C · undeclared length asks, with the canvas value suggested', () => {
    const p = findProblems(UNDEFINED_LEN, { lengths: { ema21: 21 } });
    expect(p[0]).toMatchObject({ kind: 'needs', line: 5, message: "Undeclared identifier 'len'" });
    expect(p[0].options?.[0].label).toBe('21 · matches canvas');
  });
  it('2A · five problems: 4 AI can fix, 1 needs you', () => {
    const p = findProblems(BROKEN_5);
    expect(p.map((x) => [x.line, x.kind])).toEqual([[4, 'garbled'], [5, 'garbled'], [11, 'bracket'], [14, 'needs'], [15, 'typo']]);
  });
  it('3 · request.security is not supported (not an error)', () => {
    const p = findProblems(NOT_SUPPORTED);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kind: 'unsupported', line: 7 });
  });
  it('code only: memory between candles', () => {
    const r = compile(CODE_ONLY);
    expect(r.ok && r.codeOnly).toBe(true);
  });
  it('partly fits: line 7 becomes one custom logic block', () => {
    const r = compile(PARTLY_FITS);
    expect(r.ok && r.customLines).toEqual([7]);
  });
  it('no entry: needs you', () => {
    expect(findProblems(NO_ENTRY)[0]).toMatchObject({ kind: 'needs', message: 'No strategy.entry call' });
  });
  it('fixing all 5 (needs-you answered) compiles', () => {
    const lines = BROKEN_5.split('\n');
    for (const p of findProblems(BROKEN_5)) lines[p.line - 1] = p.fix?.line ?? p.options![0].line!;
    expect(compile(lines.join('\n')).ok).toBe(true);
  });
});

describe('canvas → code patching keeps your code', () => {
  const before = demoStrategy();
  const was = pineText(before, 'Test');
  it('adding a block keeps your comment, names and spacing', () => {
    const mine = was.replace('// Entry · on candle close', '// Entry · RSI must confirm').replace('ema21 = ', 'ema21   = ');
    const after = { ...before, entry: { ...before.entry, children: [...before.entry.children, cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' }))] } };
    const out = patchCode(was, mine, pineText(after, 'Test'))!;
    expect(out).toContain('// Entry · RSI must confirm');
    expect(out).toContain('ema21   = ');
    expect(out).toMatch(/volSma20\s*= ta\.sma\(volume, 20\)/);
    expect(out).toMatch(/longOk = .* and volume > volSma20/);
  });
  it('a change to a line you edited is a conflict', () => {
    const mine = was.replace('rsi > 50', 'rsi > 52');
    const rsi = before.entry.children[1] as Extract<typeof before.entry.children[number], { kind: 'cond' }>;
    const after = { ...before, entry: { ...before.entry, children: [before.entry.children[0], { ...rsi, right: { type: 'number' as const, value: 60 } }] } };
    expect(patchCode(was, mine, pineText(after, 'Test'))).toBeNull();
  });
});
