/*
  Saved strategies for the My Strategies panel (design/strategies-panel).
  `updatedAt` only orders the list (last edited first); it's never shown.
  `live` / `forwardTests` = how many trades of each kind are running right now.
*/

export interface SavedStrategy {
  id: string;
  name: string;
  indexSymbol: string;
  updatedAt: number;
  live: number;
  forwardTests: number;
}

export interface IndexInfo {
  symbol: string;
  /** the instrument's own logo (AlgoTest icon set). None yet: the panel shows a letter tile. */
  logoUrl?: string;
}

/** Order of index rows in the panel. */
export const INDEXES: IndexInfo[] = [
  { symbol: 'NIFTY' },
  { symbol: 'SENSEX' },
  { symbol: 'ETH' },
  { symbol: 'BTC' },
  { symbol: 'GROWW' },
  { symbol: 'ASIANPAINT' },
];

const t = (minutesAgo: number) => Date.UTC(2026, 10, 2, 9, 0) - minutesAgo * 60_000;

export const SAVED_STRATEGIES: SavedStrategy[] = [
  { id: 's-ema', name: 'EMA 9/21 + RSI Trend', indexSymbol: 'NIFTY', updatedAt: t(20), live: 1, forwardTests: 0 },
  { id: 's-rsi-dip', name: 'RSI Dip & Breakout', indexSymbol: 'NIFTY', updatedAt: t(90), live: 0, forwardTests: 0 },
  { id: 's-strangle', name: 'Nifty weekly short strangle with VWAP filter and RSI exit', indexSymbol: 'NIFTY', updatedAt: t(300), live: 0, forwardTests: 0 },
  { id: 's-strangle-2', name: 'Nifty weekly short strangle with VWAP filter, RSI exit and time-based stop loss after 2 PM', indexSymbol: 'NIFTY', updatedAt: t(900), live: 0, forwardTests: 1 },
  { id: 's-ic', name: 'Iron Condor', indexSymbol: 'SENSEX', updatedAt: t(30), live: 0, forwardTests: 1 },
  { id: 's-bps', name: 'Bear Put Spread', indexSymbol: 'SENSEX', updatedAt: t(60), live: 0, forwardTests: 0 },
  { id: 's-bcs', name: 'Bull Call Spread', indexSymbol: 'SENSEX', updatedAt: t(120), live: 2, forwardTests: 1 },
  { id: 's-eth-funding', name: 'ETH Funding Fade', indexSymbol: 'ETH', updatedAt: t(200), live: 0, forwardTests: 0 },
  { id: 's-eth-retest', name: 'ETH Breakout Retest', indexSymbol: 'ETH', updatedAt: t(400), live: 0, forwardTests: 0 },
  { id: 's-btc-trend', name: 'BTC Trend Rider', indexSymbol: 'BTC', updatedAt: t(150), live: 1, forwardTests: 0 },
  { id: 's-btc-range', name: 'BTC Range Scalper', indexSymbol: 'BTC', updatedAt: t(600), live: 0, forwardTests: 0 },
  { id: 's-groww-orb', name: 'Opening Range Breakout', indexSymbol: 'GROWW', updatedAt: t(500), live: 0, forwardTests: 0 },
  { id: 's-ap-mr', name: 'RSI Mean Reversion', indexSymbol: 'ASIANPAINT', updatedAt: t(250), live: 0, forwardTests: 1 },
  { id: 's-ap-gap', name: 'Gap Fill Fade', indexSymbol: 'ASIANPAINT', updatedAt: t(700), live: 0, forwardTests: 0 },
];

/** The setups a strategy can be traded with (Trade popup). */
export const TRADE_SETUPS = ['Iron Condor', 'Bull Call Spread', 'Short Straddle', 'Long Put'];
