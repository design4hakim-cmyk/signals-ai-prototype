/*
  Demo scripts for the Pine Script editor (design/pine-editor · Review states).
  Toolbar ⋯ → Load example puts one in the editor, so every state is reachable by clicking.
  They follow the boards: the same "EMA 9/21 + RSI Trend" strategy with one thing wrong.
*/

const head = (name = 'EMA 9/21 + RSI Trend') => ['//@version=5', `strategy("${name}", overlay=true)`, ''];
const tail = ['', '// Exit', 'if ta.crossunder(ema9, ema21)', '    strategy.close("BUY")'];

/** 1A · one typo (line 15) */
export const ONE_TYPO = [
  ...head(),
  'ema9  = ta.ema(close, 9)',
  'ema21 = ta.ema(close, 21)',
  'rsi   = ta.rsi(close, 14)',
  '',
  '// Entry · on candle close',
  'longOk = ta.crossover(ema9, ema21) and rsi > 50',
  'if longOk and barstate.isconfirmed',
  '    strategy.entry("BUY", strategy.long)',
  '',
  '// Exit',
  'if ta.crossunder(ema9, ema21)',
  "    strategy.close(\"BUY\", commCent='exit')",
].join('\n');

/** 1C · `len` was never defined (line 5): needs you */
export const UNDEFINED_LEN = [
  ...head(),
  'ema9  = ta.ema(close, 9)',
  'ema21 = ta.ema(close, len)',
  'rsi   = ta.rsi(close, 14)',
  '',
  '// Entry · on candle close',
  'longOk = ta.crossover(ema9, ema21) and rsi > 50',
  'if longOk and barstate.isconfirmed',
  '    strategy.entry("BUY", strategy.long)',
  ...tail,
].join('\n');

/** 2A · five problems: 4 AI can fix, 1 needs you */
export const BROKEN_5 = [
  ...head(),
  'ema9  = tQNDa.ema(close, 9)',
  'ema21 = ta.ema(cWENMDlose, 21)',
  'rsi   = ta.rsi(close, 14)',
  '',
  '// Entry · on candle close',
  'longOk = ta.crossover(ema9, ema21) and rsi > 50',
  'if longOk and barstate.isconfirmed',
  '    strategy.entry("BUY", strategy.long ',
  '',
  '// Exit',
  'if ta.crossunder(ema9, emaSlow)',
  "    strategy.close(\"BUY\", commCent='exit')",
].join('\n');

/** 3 · valid code AlgoTest can't run yet (line 7) */
export const NOT_SUPPORTED = [
  ...head(),
  'ema9  = ta.ema(close, 9)',
  'ema21 = ta.ema(close, 21)',
  'rsi   = ta.rsi(close, 14)',
  'bnf   = request.security("BANKNIFTY", "D", close)',
  '',
  '// Entry · on candle close',
  'longOk = ta.crossover(ema9, ema21) and bnf > bnf[1]',
  'if longOk and barstate.isconfirmed',
  '    strategy.entry("BUY", strategy.long)',
  ...tail,
].join('\n');

/** Partly fits: line 7 becomes one Custom logic block */
export const PARTLY_FITS = [
  ...head(),
  'ema9   = ta.ema(close, 9)',
  'ema21  = ta.ema(close, 21)',
  'rsi    = ta.rsi(close, 14)',
  'dipped = ta.lowest(rsi, 10) < 40',
  '',
  '// Entry · on candle close',
  'longOk = ta.crossover(rsi, 60) and dipped',
  'if longOk and barstate.isconfirmed',
  '    strategy.entry("BUY", strategy.long)',
  ...tail,
].join('\n');

/** Code only: memory between candles (var, :=) */
export const CODE_ONLY = [
  ...head(),
  'ema9  = ta.ema(close, 9)',
  'ema21 = ta.ema(close, 21)',
  'rsi   = ta.rsi(close, 14)',
  'var armed = false',
  'if rsi < 40',
  '    armed := true',
  '',
  '// Entry · on candle close',
  'if armed and ta.crossover(rsi, 70) and barstate.isconfirmed',
  '    strategy.entry("BUY", strategy.long)',
  '    armed := false',
].join('\n');

/** No entry: valid code that never buys (needs you) */
export const NO_ENTRY = [
  ...head(),
  'ema9  = ta.ema(close, 9)',
  'ema21 = ta.ema(close, 21)',
  'rsi   = ta.rsi(close, 14)',
  '',
  '// Entry · on candle close',
  'longOk = ta.crossover(ema9, ema21) and rsi > 50',
  ...tail,
].join('\n');

export const EXAMPLES = [
  { id: 'typo', label: 'With 1 typo', code: ONE_TYPO },
  { id: 'len', label: 'With an undefined length', code: UNDEFINED_LEN },
  { id: 'five', label: 'With 5 problems', code: BROKEN_5 },
  { id: 'unsupported', label: 'Not supported', code: NOT_SUPPORTED },
  { id: 'custom', label: 'Partly fits (custom logic)', code: PARTLY_FITS },
  { id: 'codeOnly', label: 'Code only', code: CODE_ONLY },
  { id: 'noEntry', label: 'No entry', code: NO_ENTRY },
] as const;
