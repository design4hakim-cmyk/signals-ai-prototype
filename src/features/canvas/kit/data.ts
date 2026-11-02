// Demo content for the canvas builder kit (indicator list, logic words).

export interface IndicatorOption {
  name: string;
  short: string;
  fav?: boolean;
}

export const DEMO_INDICATORS: IndicatorOption[] = [
  { name: 'Exponential Moving Average', short: 'EMA', fav: true },
  { name: 'Simple Moving Average', short: 'SMA', fav: true },
  { name: 'Relative Strength Index', short: 'RSI' },
  { name: 'Weighted Moving Average', short: 'WMA' },
  { name: 'Bollinger Bands', short: 'BB' },
  { name: 'Volume Weighted Average Price', short: 'VWAP' },
];

export type LogicWord = 'All of' | 'Any of' | 'None of';
export const LOGIC: { word: LogicWord; hint: string }[] = [
  { word: 'All of', hint: 'Every condition is true' },
  { word: 'Any of', hint: 'At least one is true' },
  { word: 'None of', hint: 'No condition is true' },
];

