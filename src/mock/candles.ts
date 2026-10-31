import type { Candle, Instrument, Timeframe } from '@/types/market';

/*
  Mock market data. No backend: we generate believable candles in the browser.
  "Seeded" means the same instrument + timeframe always gives the same chart,
  so screenshots and demos look identical every time.
*/

const START_PRICE: Record<Instrument, number> = {
  NIFTY: 24850,
  BANKNIFTY: 52300,
  FINNIFTY: 23400,
  SENSEX: 81500,
};

const TF_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '1D': 86400,
};

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

export function generateCandles(
  instrument: Instrument,
  timeframe: Timeframe,
  count = 300,
): Candle[] {
  const rand = seededRandom(hash(instrument + timeframe));
  const step = TF_SECONDS[timeframe];
  let price = START_PRICE[instrument];
  const volatility = price * 0.0025;

  // Walk back from Fri 30 Oct 2026, 15:30, keeping only NSE market hours
  // (Mon–Fri, 09:15–15:30). Times are stored as Indian "wall clock" so the
  // chart's axis reads 09:15, not the UTC equivalent.
  const times: number[] = [];
  let t = Date.UTC(2026, 9, 30, 15, 30) / 1000;
  while (times.length < count) {
    t -= step;
    const d = new Date(t * 1000);
    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    const weekday = d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
    const open = step >= 86400 || (minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30);
    if (weekday && open) times.unshift(t);
  }

  const candles: Candle[] = [];
  for (let i = count; i > 0; i--) {
    const open = price;
    // gentle waves + noise so it looks like a real trending market
    const drift = Math.sin(i / 18) * volatility * 0.35;
    const close = open + drift + (rand() - 0.5) * volatility * 2;
    const high = Math.max(open, close) + rand() * volatility * 0.8;
    const low = Math.min(open, close) - rand() * volatility * 0.8;
    candles.push({ time: times[count - i], open, high, low, close });
    price = close;
  }
  return candles;
}
