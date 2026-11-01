import { generateSeries } from '@/mock/candles';
import { computeSignals, type Limits, type SignalResult } from '@/lib/signals';
import { useStrategy } from '@/store/strategy';
import { useWorkspace, type ChartInputs } from '@/store/workspace';
import type { Candle } from '@/types/market';

/*
  Candles + signals for what the chart was LAST UPDATED with (`applied`),
  not the latest choices — that's what "the chart is paused" means.
  Results are cached, so many components can ask without recalculating.
*/

const candleCache = new Map<string, Candle[]>();
const signalCache = new Map<string, SignalResult>();

function candlesFor(a: ChartInputs) {
  const key = JSON.stringify([a.instrument, a.timeframe, a.chartData, a.period]);
  if (!candleCache.has(key)) candleCache.set(key, generateSeries(a.instrument, a.timeframe, a.chartData, a.period));
  return { key, candles: candleCache.get(key)! };
}

function signalsFor(key: string, candles: Candle[], limits: Limits) {
  const k = key + JSON.stringify(limits);
  if (!signalCache.has(k)) signalCache.set(k, computeSignals(candles, limits));
  return signalCache.get(k)!;
}

export function useAppliedChart() {
  const applied = useWorkspace((s) => s.applied);
  const limits = useWorkspace((s) => s.limits);
  const entry = useStrategy((s) => s.entry);
  const noSignals = useStrategy((s) => s.noSignals);

  const { key, candles } = candlesFor(applied);
  const hasStrategy = entry !== 'empty';
  const live = hasStrategy && !noSignals;
  const signals = live ? signalsFor(key, candles, limits) : null;
  // counts with NO limits, to show "148 → 131" in the limit panels
  const unlimited = live ? signalsFor(key, candles, { openAtOnce: null, perDay: null }) : null;
  return { applied, candles, signals, unlimited, hasStrategy, noSignals };
}
