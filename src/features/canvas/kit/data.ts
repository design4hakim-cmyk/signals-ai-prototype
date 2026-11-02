// Demo content for the canvas builder kit (indicator list, logic words).

export interface IndicatorOption {
  name: string;
  short: string;
  fav?: boolean;
  /** Trend / Momentum / Volume — the picker's category chips */
  category?: string;
  /** app: which indicator this is */
  id?: string;
}

export const DEMO_INDICATORS: IndicatorOption[] = [
  { name: 'Exponential Moving Average', short: 'EMA', fav: true, category: 'Trend' },
  { name: 'Simple Moving Average', short: 'SMA', fav: true, category: 'Trend' },
  { name: 'Relative Strength Index', short: 'RSI', category: 'Momentum' },
  { name: 'Weighted Moving Average', short: 'WMA', category: 'Trend' },
  { name: 'Bollinger Bands', short: 'BB', category: 'Trend' },
  { name: 'Volume Weighted Average Price', short: 'VWAP', category: 'Volume' },
];

export type LogicWord = 'All of' | 'Any of' | 'None of';
export const LOGIC: { word: LogicWord; hint: string }[] = [
  { word: 'All of', hint: 'Every condition is true' },
  { word: 'Any of', hint: 'At least one is true' },
  { word: 'None of', hint: 'No condition is true' },
];

