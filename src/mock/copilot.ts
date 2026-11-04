import type { CopilotStarter } from '@/types/market';
import type { Condition, Operand } from '@/types/strategy';
import { cond, ind, num } from './strategies';

/*
  Scripted Copilot (design/copilot · Mock data). No real AI:
  the prompt is matched by keywords to one of these replies.
*/

// Starter prompts in the empty state (copy from the CP boards)
export const copilotStarters: CopilotStarter[] = [
  { id: 'sma-cross', title: 'Simple Moving Average Crossover', description: 'Buy when the fast MA crosses above the slow MA.' },
  { id: 'macd-cross', title: 'MACD Signal Crossover', description: 'Enter on a MACD crossover with confirmation.' },
  { id: 'ma-macd', title: 'MA + MACD Confirmation', description: 'Enter on an MA crossover confirmed by MACD.' },
];

export const mockUser = { firstName: 'Hakim' };

export type ScriptId = 'chat' | 'march' | 'stopLoss' | 'why' | 'exit' | 'main' | 'refineAdd' | 'review' | 'partlyFits' | 'codeOnly' | 'failed' | 'vague';

/**
 * Which scripted reply a prompt gets. Plain questions and small talk get a text answer;
 * only a described strategy builds; "make me money" asks for a style (design/copilot · Edge cases).
 */
export function matchScript(text: string): { id: ScriptId; entry?: () => Condition[] } {
  const t = text.toLowerCase().trim();
  if (/profitab|make me money|best strategy|guaranteed/.test(t)) return { id: 'vague' };
  if (/march/.test(t) && /lose|loss|lost|bad/.test(t)) return { id: 'march' };
  if (/stop.?loss/.test(t)) return { id: 'stopLoss' };
  if (/why no trade|why didn.t|why did(n.t)? it not/.test(t)) return { id: 'why' };
  if (/at least once in the last/.test(t)) return { id: 'partlyFits' };
  if (/re-?arm/.test(t)) return { id: 'codeOnly' };
  if (/vwap/.test(t) && /3:15|15:15/.test(t)) return { id: 'failed' };
  if (/stricter|fewer signals|drop the|remove the/.test(t)) return { id: 'review' };
  if (/volume/.test(t) && /average|above|filter/.test(t)) return { id: 'refineAdd' };
  // asking for an exit only (no entry words): add it to Exit
  if (/\bexit|sell when|close (the )?(trade|position)|get out/.test(t) && !/\b(buy|enter|entry|long)\b/.test(t)) return { id: 'exit' };
  // a question or small talk is answered in words, never by building
  if (/\?$/.test(t) || /^(hi|hey|hello|thanks|thank you|ok|okay|what|why|how|did|does|do|is|are|can|could|should|when|where|which|explain|tell me)\b/.test(t)) return { id: 'chat' };
  if (/macd/.test(t) && /\bma\b|moving average|crossover/.test(t) && /confirm/.test(t)) return { id: 'main', entry: maMacdEntry };
  if (/macd/.test(t)) return { id: 'main', entry: macdEntry };
  if (/moving average|\bma\b|\bsma\b/.test(t) && !/ema/.test(t)) return { id: 'main', entry: smaEntry };
  if (/breakout|bollinger/.test(t)) return { id: 'main', entry: breakoutEntry };
  if (/dip|rsi below 30|oversold/.test(t)) return { id: 'main', entry: dipEntry };
  if (/ema|rsi|cross|trend/.test(t)) return { id: 'main', entry: mainEntry };
  return { id: 'chat' };
}

/* ── Entries each script builds ────────────────────────────────── */

export const mainEntry = () => [
  cond(ind('ema', { length: 9 }), 'Cross Above', ind('ema', { length: 21 })),
  cond(ind('rsi'), 'Greater Than', num(50)),
];
const smaEntry = () => [cond(ind('sma', { length: 9 }), 'Cross Above', ind('sma', { length: 21 }))];
// MACD isn't a canvas indicator: its line crossing is the EMA 12 / EMA 26 cross
const macdEntry = () => [cond(ind('ema', { length: 12 }), 'Cross Above', ind('ema', { length: 26 }))];
const maMacdEntry = () => [
  cond(ind('sma', { length: 9 }), 'Cross Above', ind('sma', { length: 21 })),
  cond(ind('ema', { length: 12 }), 'Greater Than', ind('ema', { length: 26 })),
];
const breakoutEntry = () => [
  cond(ind('price'), 'Cross Above', ind('bb', { band: 'Upper' })),
  cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' }, { op: '×', value: 1.5 })),
];
const dipEntry = () => [cond(ind('rsi'), 'Cross Above', num(30))];

export const mainExit = () => cond(ind('ema', { length: 9 }), 'Cross Below', ind('ema', { length: 21 }));
export const volumeFilter = () => cond(ind('volume'), 'Greater Than', ind('sma', { length: 20, source: 'Volume' }));

const short = (o: Operand) =>
  o.type === 'number' ? String(o.value) : o.id === 'sma' ? `MA ${o.params.length}` : o.id === 'ema' ? `EMA ${o.params.length}` : o.id === 'price' ? 'Close' : o.id.toUpperCase();

/** The suggested exit mirrors the entry: a cross above exits on the same cross below. */
export function exitFor(entry: Condition[]): { label: string; cond: () => Condition } {
  const cross = entry.find((c) => c.relation === 'Cross Above' && c.left?.type === 'indicator' && c.right?.type === 'indicator' && c.left.id !== 'price');
  if (cross?.left && cross.right) {
    const { left, right } = cross;
    return { label: `${short(left)} crosses below ${short(right)}`, cond: () => cond(structuredClone(left), 'Cross Below', structuredClone(right)) };
  }
  if (entry.some((c) => c.left?.type === 'indicator' && c.left.id === 'rsi')) return { label: 'RSI drops below 50', cond: rsiExit };
  return { label: 'EMA 9 crosses below EMA 21', cond: mainExit };
}

/** First option is replaced per card by exitFor(entry). */
export const EXIT_OPTIONS = [
  { label: 'EMA 9 crosses below EMA 21', suggested: true },
  { label: 'At a fixed time, 15:15' },
  { label: "I'll set it on the canvas" },
];

export const VAGUE_OPTIONS = [
  { label: 'Follow the trend', hint: 'EMA 9 crosses EMA 21, filtered by RSI', entry: mainEntry },
  { label: 'Catch breakouts', hint: 'Close above Bollinger upper band with high volume', entry: breakoutEntry },
  { label: 'Buy the dip', hint: 'RSI below 30, then turns back up', entry: dipEntry },
];

/* Partly fits: build anyway / simplify */
export const partlyFitsEntry = () => [
  cond(ind('rsi'), 'Cross Above', num(60)),
  { ...cond(null, null, null), custom: { text: 'RSI was below 40 in the last 10 candles', name: 'dipped', expr: 'ta.lowest(rsi, 10) < 40' } },
];
export const simplifiedEntry = () => [cond(ind('rsi'), 'Cross Above', num(60)), cond(ind('rsi', { offset: 1 }), 'Less Than', num(40))];
export function rsiExit() {
  return cond(ind('rsi'), 'Less Than', num(50));
}

/* Build failed, partly: the entry goes on, the 15:15 time exit doesn't */
export const vwapEntry = () => [
  cond(ind('price'), 'Greater Than', ind('vwap')),
  cond(ind('rsi'), 'Cross Above', num(60)),
  cond(ind('price'), 'Cross Above', ind('bb', { band: 'Upper' })),
];

/** Follow-ups after a strategy is ready. */
export const NEXT_STEPS = ['Looks right · Run backtest', 'Fewer signals, please', 'Why no trade on 15 Mar?'];

export const WHY_ANSWER = 'On 15 Mar, EMA 9 stayed below EMA 21 all day, so the entry never fired. Check on chart to see that day.';

export const STOP_LOSS_ANSWER = 'Stop losses live in the Backtest setup, so every setup can have its own. Open the Backtest tab and set “Stop loss per trade”; the entry and exit stay as they are.';

/** Fake timing (ms). */
export const TIMING = { understood: 600, place: 500 };
