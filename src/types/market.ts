// Types = the "shape" of our data. Like naming the layers and properties
// of a Figma component so everyone knows what goes where.

export type Instrument = 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'SENSEX';
export type ChartData = 'SPOT' | 'FUTURE' | 'OPTION' | 'COMBINED PREMIUM';
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1D';
export type Period = '1M' | '3M' | '6M' | '1Y' | '3Y';

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
