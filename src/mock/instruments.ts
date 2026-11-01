import type {
  ChartDataKind,
  CombinedLeg,
  CombinedTemplate,
  Expiry,
  Instrument,
  InstrumentKind,
  Multiply,
  OptionLeg,
  Strike,
  StrikeCriteria,
  Timeframe,
} from '@/types/market';

/* Everything the context bar menus offer. Edit these lists to change the menus. */

export const instruments: { id: Instrument; kind: InstrumentKind }[] = [
  { id: 'NIFTY', kind: 'Index' },
  { id: 'BANKNIFTY', kind: 'Index' },
  { id: 'FINNIFTY', kind: 'Index' },
  { id: 'SENSEX', kind: 'Index' },
  { id: 'BTCUSD', kind: 'Crypto' },
];

export const kindOf = (i: Instrument): InstrumentKind =>
  instruments.find((x) => x.id === i)?.kind ?? 'Index';

export const timeframes: Timeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1D'];

export const chartDataKinds: { kind: ChartDataKind; label: string; hint: string }[] = [
  { kind: 'spot', label: 'Spot', hint: 'The index price' },
  { kind: 'option', label: 'Option', hint: "One option's premium" },
  { kind: 'perpetual', label: 'Perpetual Future', hint: 'No-expiry futures price' },
  { kind: 'synthetic', label: 'Synthetic Future', hint: 'Built from ATM call and put' },
  { kind: 'combined', label: 'Combined Premium', hint: 'Up to 4 option legs added' },
];

/**
 * Which chart data types an instrument supports.
 * Design decision (phase 1): perpetual futures only exist for crypto;
 * Indian indices don't have them, so the option is shown but disabled.
 */
export function unavailableReason(kind: ChartDataKind, instrument: Instrument): string | null {
  if (kind === 'perpetual' && kindOf(instrument) !== 'Crypto') return 'Only for crypto';
  return null;
}

export const strikes: Strike[] = ['ITM3', 'ITM2', 'ITM1', 'ATM', 'OTM1', 'OTM2', 'OTM3', 'OTM4'];
export const expiries: Expiry[] = ['Weekly', 'Next weekly', 'Monthly'];
export const criteriaOptions: StrikeCriteria[] = ['Strike Type', 'Closest premium', 'Premium ≥', 'Premium ≤'];
export const multiplyOptions: Multiply[] = [-2, -1, 1, 2];
export const MAX_LEGS = 4;

export const defaultLeg: OptionLeg = {
  optionType: 'Call',
  timing: 'Rolling',
  fixedAt: '09:15',
  expiry: 'Weekly',
  criteria: 'Strike Type',
  strike: 'ATM',
  premium: 100,
};

let legCounter = 0;
export const newLeg = (patch: Partial<CombinedLeg> = {}): CombinedLeg => ({
  ...defaultLeg,
  multiply: -1,
  id: `leg-${++legCounter}`,
  ...patch,
});

/** Leg presets for the template chips (K08). −1 = sell, 1 = buy. */
export function templateLegs(t: CombinedTemplate): CombinedLeg[] {
  switch (t) {
    case 'Straddle':
      return [newLeg({ optionType: 'Call' }), newLeg({ optionType: 'Put' })];
    case 'Strangle':
      return [
        newLeg({ optionType: 'Call', strike: 'OTM1' }),
        newLeg({ optionType: 'Put', strike: 'OTM1' }),
      ];
    case 'Iron Condor':
      return [
        newLeg({ optionType: 'Call', strike: 'OTM1' }),
        newLeg({ optionType: 'Put', strike: 'OTM1' }),
        newLeg({ optionType: 'Call', strike: 'OTM4', multiply: 1 }),
        newLeg({ optionType: 'Put', strike: 'OTM4', multiply: 1 }),
      ];
    case 'Iron Fly':
      return [
        newLeg({ optionType: 'Call' }),
        newLeg({ optionType: 'Put' }),
        newLeg({ optionType: 'Call', strike: 'OTM3', multiply: 1 }),
        newLeg({ optionType: 'Put', strike: 'OTM3', multiply: 1 }),
      ];
  }
}
