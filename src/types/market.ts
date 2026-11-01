// Types = the "shape" of our data. Like naming the layers and properties
// of a Figma component so everyone knows what goes where.

export type Instrument = 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'SENSEX' | 'BTCUSD';
export type InstrumentKind = 'Index' | 'Crypto';
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D';
export type Period = '1M' | '3M' | '6M' | '1Y' | '3Y';

/* ── Chart data (board K02 → K10) ─────────────────────────────── */

export type OptionType = 'Call' | 'Put';
export type StrikeTiming = 'Rolling' | 'Fixed';
export type Expiry = 'Weekly' | 'Next weekly' | 'Monthly';
export type StrikeCriteria = 'Strike Type' | 'Closest premium' | 'Premium ≥' | 'Premium ≤';
export type Strike = 'ITM3' | 'ITM2' | 'ITM1' | 'ATM' | 'OTM1' | 'OTM2' | 'OTM3' | 'OTM4';
export type Multiply = -2 | -1 | 1 | 2;

/** One option contract, as picked in the Option panel or a combined-premium row */
export interface OptionLeg {
  optionType: OptionType;
  timing: StrikeTiming;
  fixedAt: string; // "09:15", only used when timing is Fixed
  expiry: Expiry;
  criteria: StrikeCriteria;
  strike: Strike; // used when criteria is "Strike Type"
  premium: number; // ₹, used for the premium-based criteria
}

export interface CombinedLeg extends OptionLeg {
  id: string;
  multiply: Multiply; // −1 sells the leg, 1 buys it
}

export type CombinedTemplate = 'Straddle' | 'Strangle' | 'Iron Condor' | 'Iron Fly';

/** What the chart plots. "kind" decides which other fields exist. */
export type ChartData =
  | { kind: 'spot' }
  | { kind: 'perpetual' }
  | { kind: 'synthetic' }
  | { kind: 'option'; leg: OptionLeg }
  | { kind: 'combined'; template: CombinedTemplate | null; legs: CombinedLeg[] };

export type ChartDataKind = ChartData['kind'];

/* ── Market data ──────────────────────────────────────────────── */

/** One candle on the chart: open, high, low, close at a moment in time. */
export interface Candle {
  time: number; // seconds since 1970 (what the chart library expects)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CopilotStarter {
  id: string;
  title: string;
  description: string;
}
