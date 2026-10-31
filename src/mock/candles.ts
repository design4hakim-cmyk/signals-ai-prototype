import type { Candle, ChartData, Instrument, OptionLeg, Strike, Timeframe } from '@/types/market';
import { kindOf } from './instruments';

/*
  Mock market data. No backend: we generate believable candles in the browser.
  "Seeded" means the same choice always gives the same chart, so screenshots
  and demos look identical every time.
*/

const SPOT_PRICE: Record<Instrument, number> = {
  NIFTY: 24850,
  BANKNIFTY: 52300,
  FINNIFTY: 23400,
  SENSEX: 81500,
  BTCUSD: 68400,
};

const TF_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
};

// How expensive each strike is compared with ATM (rough, but believable)
const STRIKE_FACTOR: Record<Strike, number> = {
  ITM3: 2.2, ITM2: 1.7, ITM1: 1.3, ATM: 1, OTM1: 0.7, OTM2: 0.48, OTM3: 0.32, OTM4: 0.2,
};
const EXPIRY_FACTOR = { Weekly: 1, 'Next weekly': 1.4, Monthly: 2.2 };

// Tiny predictable random-number generator (same seed → same numbers)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Candle timestamps: NSE hours (Mon–Fri 09:15–15:30) for indices, 24/7 for crypto. */
function candleTimes(timeframe: Timeframe, count: number, allDay: boolean) {
  const step = TF_SECONDS[timeframe];
  const times: number[] = [];
  let t = Date.UTC(2026, 9, 30, 15, 30) / 1000; // Fri 30 Oct 2026, 15:30 (stored as IST wall clock)
  while (times.length < count) {
    t -= step;
    if (allDay) {
      times.unshift(t);
      continue;
    }
    const d = new Date(t * 1000);
    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    const weekday = d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
    const open = step >= 86400 || (minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30);
    if (weekday && open) times.unshift(t);
  }
  return times;
}

/** A price walk. Multiplies by small % moves, so prices never go below zero. */
function walk(seedKey: string, start: number, volPct: number, times: number[]): Candle[] {
  const rand = seededRandom(hash(seedKey));
  let price = start;
  return times.map((time, i) => {
    const open = price;
    const wave = Math.sin(i / 18) * volPct * 0.35;
    const close = open * (1 + wave + (rand() - 0.5) * volPct * 2);
    const high = Math.max(open, close) * (1 + rand() * volPct * 0.8);
    const low = Math.min(open, close) * (1 - rand() * volPct * 0.8);
    price = close;
    return { time, open, high, low, close };
  });
}

function legPremium(instrument: Instrument, leg: OptionLeg) {
  if (leg.criteria !== 'Strike Type') return leg.premium;
  const atm = SPOT_PRICE[instrument] * 0.006; // NIFTY ATM weekly ≈ ₹150
  return atm * STRIKE_FACTOR[leg.strike] * EXPIRY_FACTOR[leg.expiry];
}

const legKey = (l: OptionLeg) => JSON.stringify(l);

export function generateSeries(
  instrument: Instrument,
  timeframe: Timeframe,
  chartData: ChartData,
  count = 300,
): Candle[] {
  const times = candleTimes(timeframe, count, kindOf(instrument) === 'Crypto');
  const spot = SPOT_PRICE[instrument];
  const base = `${instrument}|${timeframe}|`;

  switch (chartData.kind) {
    case 'spot':
      return walk(base + 'spot', spot, 0.0025, times);
    case 'perpetual':
      return walk(base + 'perp', spot * 1.0004, 0.0027, times);
    case 'synthetic':
      return walk(base + 'synth', spot * 1.0018, 0.0026, times);
    case 'option':
      return walk(base + legKey(chartData.leg), legPremium(instrument, chartData.leg), 0.03, times);
    case 'combined': {
      // Sum every leg's premium × multiply, candle by candle
      const series = chartData.legs.map((l) => ({
        m: l.multiply,
        c: walk(base + legKey(l), legPremium(instrument, l), 0.03, times),
      }));
      return times.map((time, i) => {
        const open = series.reduce((s, x) => s + x.m * x.c[i].open, 0);
        const close = series.reduce((s, x) => s + x.m * x.c[i].close, 0);
        const wick = Math.abs(close - open) * 0.4 + 0.5;
        return { time, open, close, high: Math.max(open, close) + wick, low: Math.min(open, close) - wick };
      });
    }
  }
}
