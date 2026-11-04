import { generateSeries } from '@/mock/candles';
import { computeSignals, type Limits, type SignalResult } from '@/lib/signals';
import { flatConditions, isComplete } from '@/lib/conditions';
import { useCanvas } from '@/store/canvas';
import { useStrategy } from '@/store/strategy';
import { useWorkspace, type ChartInputs } from '@/store/workspace';
import type { Candle } from '@/types/market';
import type { StrategyTree } from '@/types/strategy';

/*
  Candles + signals for what the chart was LAST UPDATED with (`applied`,
  both the context and the canvas conditions), not the latest choices —
  that's what "the chart is paused" means.
  Results are cached, so many components can ask without recalculating.
*/

const candleCache = new Map<string, Candle[]>();
const signalCache = new Map<string, SignalResult>();

function candlesFor(a: ChartInputs) {
  const key = JSON.stringify([a.instrument, a.timeframe, a.chartData, a.period]);
  if (!candleCache.has(key)) candleCache.set(key, generateSeries(a.instrument, a.timeframe, a.chartData, a.period));
  return { key, candles: candleCache.get(key)! };
}

function signalsFor(key: string, candles: Candle[], limits: Limits, strategy: StrategyTree) {
  const k = key + JSON.stringify(limits) + JSON.stringify(strategy, (name, v) => (name === 'id' ? undefined : v));
  if (!signalCache.has(k)) signalCache.set(k, computeSignals(candles, limits, strategy));
  return signalCache.get(k)!;
}

export function useAppliedChart() {
  const applied = useWorkspace((s) => s.applied);
  const limits = useWorkspace((s) => s.limits);
  const entry = useStrategy((s) => s.entry);
  const noSignals = useStrategy((s) => s.noSignals);
  const strategy = useCanvas((s) => s.applied);

  const { key, candles } = candlesFor(applied);
  // the chart was drawn with at least one finished entry condition
  const drawn = flatConditions(strategy.entry).some(isComplete);
  const hasStrategy = entry !== 'empty' || drawn;
  const live = hasStrategy && !noSignals;
  const signals = live ? signalsFor(key, candles, limits, strategy) : null;
  // counts with NO limits, to show "148 → 131" in the limit panels
  const unlimited = live ? signalsFor(key, candles, { openAtOnce: null, perDay: null }, strategy) : null;
  return { applied, candles, signals, unlimited, hasStrategy, noSignals };
}
