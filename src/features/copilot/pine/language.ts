import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { hoverTooltip } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/*
  Pine Script for CodeMirror (design/pine-editor · Atoms "Syntax colours", Molecules
  "Autocomplete" and "Hover doc"). Colours are the --color-code-* tokens.
*/

const KEYWORDS = new Set(['if', 'else', 'and', 'or', 'not', 'var', 'for', 'while', 'to', 'switch']);
const BUILTINS = /^(close|open|high|low|volume|hlc3|hl2|ohlc4|true|false|na|strategy\.long|strategy\.short|barstate\.\w+)$/;

export const pine = StreamLanguage.define<{ inString: string | null }>({
  name: 'pine',
  startState: () => ({ inString: null }),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^"[^"]*"?/) || stream.match(/^'[^']*'?/)) return 'string';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    const word = stream.match(/^[A-Za-z_][\w.]*/) as RegExpMatchArray | null;
    if (word) {
      const w = word[0];
      if (BUILTINS.test(w)) return 'atom';
      if (KEYWORDS.has(w)) return 'keyword';
      // a call: ta.ema(, strategy.entry(, strategy(
      if (stream.peek() === '(') return 'keyword';
      return 'variableName';
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '//' } },
});

export const pineHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--color-code-keyword)' },
    { tag: tags.atom, color: 'var(--color-code-builtin)' },
    { tag: tags.string, color: 'var(--color-code-string)' },
    { tag: tags.number, color: 'var(--color-code-number)' },
    { tag: tags.comment, color: 'var(--color-code-comment)' },
    { tag: tags.variableName, color: 'var(--color-code-text)' },
  ]),
);

/* ── what each function is, in plain words ─────────────────────── */

export const DOCS: Record<string, { sig: string; text: string; canvas?: string }> = {
  'ta.ema': { sig: 'ta.ema(source, length) → series float', text: 'Exponential moving average: weights recent candles more.', canvas: 'EMA' },
  'ta.sma': { sig: 'ta.sma(source, length) → series float', text: 'Simple moving average of the last N candles.', canvas: 'MA' },
  'ta.wma': { sig: 'ta.wma(source, length) → series float', text: 'Weighted moving average.', canvas: 'WMA' },
  'ta.rsi': { sig: 'ta.rsi(source, length) → series float', text: 'Relative Strength Index, from 0 to 100.', canvas: 'RSI' },
  'ta.bb': { sig: 'ta.bb(source, length, mult) → [middle, upper, lower]', text: 'Bollinger Bands: a moving average with a band above and below.', canvas: 'Bollinger Band' },
  'ta.stoch': { sig: 'ta.stoch(source, high, low, length) → series float', text: 'Stochastic %K, from 0 to 100.', canvas: 'Stochastic' },
  'ta.vwap': { sig: 'ta.vwap(source) → series float', text: 'Volume weighted average price; resets every day.', canvas: 'VWAP' },
  'ta.crossover': { sig: 'ta.crossover(a, b) → series bool', text: 'True on the candle where a moves from below b to above it.', canvas: 'Cross Above' },
  'ta.crossunder': { sig: 'ta.crossunder(a, b) → series bool', text: 'True on the candle where a moves from above b to below it.', canvas: 'Cross Below' },
  'ta.lowest': { sig: 'ta.lowest(source, length) → series float', text: 'The lowest value over the last N candles.', canvas: 'a Custom logic block' },
  'ta.highest': { sig: 'ta.highest(source, length) → series float', text: 'The highest value over the last N candles.', canvas: 'a Custom logic block' },
  'ta.barssince': { sig: 'ta.barssince(condition) → series int', text: 'How many candles since the condition was last true.', canvas: 'a Custom logic block' },
  'strategy.entry': { sig: 'strategy.entry(id, direction, qty, comment)', text: 'Opens a position when this line runs.' },
  'strategy.close': { sig: 'strategy.close(id, comment, qty)', text: 'Closes the position with this id.' },
  'barstate.isconfirmed': { sig: 'barstate.isconfirmed → bool', text: 'True once the candle has closed.', canvas: '“On candle close”' },
  'input.int': { sig: 'input.int(defval, title) → int', text: 'A number you can change from the settings without editing code.' },
};

const completions: Completion[] = Object.entries(DOCS).map(([label, d]) => ({
  label,
  type: 'function',
  detail: d.sig.replace(/^[\w.]+/, '').replace(/\s*→.*$/, ''),
  info: d.text,
  apply: label.includes('(') || label === 'barstate.isconfirmed' ? label : `${label}(`,
}));
const words: Completion[] = ['close', 'open', 'high', 'low', 'volume', 'strategy.long', 'true', 'false'].map((label) => ({ label, type: 'variable' }));

function source(ctx: CompletionContext) {
  const w = ctx.matchBefore(/[A-Za-z_][\w.]*/);
  if (!w || (w.from === w.to && !ctx.explicit) || w.text.length < 2) return null;
  // the variables already in the code
  const vars = [...new Set([...ctx.state.doc.toString().matchAll(/^\s*([A-Za-z_]\w*)\s*=/gm)].map((m) => m[1]))].map((label) => ({ label, type: 'variable' }));
  return { from: w.from, options: [...completions, ...words, ...vars], validFor: /^[\w.]*$/ };
}

export const pineAutocomplete = autocompletion({
  override: [source],
  icons: false,
  // ƒ badge before functions (design/pine-editor · Autocomplete)
  addToOptions: [{
    render: (c) => {
      const b = document.createElement('span');
      b.className = 'cm-fbadge';
      b.textContent = c.type === 'function' ? 'ƒ' : 'x';
      return b;
    },
    position: 20,
  }],
  // the one-line description sits under the list
  positionInfo: () => ({ class: 'cm-info-below', style: '' }),
});

/** Hover a function: its signature and what it is on the canvas. */
export const pineHover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  let s = pos - line.from;
  let e = s;
  while (s > 0 && /[\w.]/.test(text[s - 1])) s--;
  while (e < text.length && /[\w.]/.test(text[e])) e++;
  const word = text.slice(s, e);
  const d = DOCS[word];
  if (!d) return null;
  return {
    pos: line.from + s,
    end: line.from + e,
    above: false,
    create: () => {
      const dom = document.createElement('div');
      dom.className = 'cm-hoverdoc';
      const sig = document.createElement('code');
      sig.textContent = d.sig;
      const p = document.createElement('p');
      p.textContent = d.text + (d.canvas ? ` On the canvas this is ${d.canvas.startsWith('a ') || d.canvas.startsWith('“') ? d.canvas : `“${d.canvas}”`}.` : '');
      dom.append(sig, p);
      return { dom };
    },
  };
});
