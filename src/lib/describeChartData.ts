import type { ChartData, OptionLeg } from '@/types/market';

/*
  Turns a chart data choice into plain words.
  Short version → the context bar ("Option · ATM CE")
  Long version  → the chart header ("NIFTY ATM Call · Weekly · Rolling")
  Board K09: "the bar shows what the chart plots".
*/

const ce = (leg: OptionLeg) => (leg.optionType === 'Call' ? 'CE' : 'PE');

function strikeText(leg: OptionLeg) {
  if (leg.criteria === 'Strike Type') return leg.strike;
  if (leg.criteria === 'Closest premium') return `≈₹${leg.premium}`;
  return `${leg.criteria.replace('Premium ', '')}₹${leg.premium}`;
}

export function shortLabel(cd: ChartData): string {
  switch (cd.kind) {
    case 'spot':
      return 'Spot';
    case 'perpetual':
      return 'Perpetual';
    case 'synthetic':
      return 'Synthetic Fut';
    case 'option':
      return `Option · ${strikeText(cd.leg)} ${ce(cd.leg)}`;
    case 'combined':
      return `${cd.template ?? 'Combined'} · ${cd.legs.length} leg${cd.legs.length === 1 ? '' : 's'}`;
  }
}

export function longLabel(cd: ChartData, instrument: string): string {
  switch (cd.kind) {
    case 'spot':
      return `${instrument} spot`;
    case 'perpetual':
      return `${instrument} perpetual future`;
    case 'synthetic':
      return `${instrument} synthetic future (ATM call − put)`;
    case 'option': {
      const l = cd.leg;
      const timing = l.timing === 'Fixed' ? `fixed at ${l.fixedAt}` : 'rolling';
      return `${instrument} ${strikeText(l)} ${l.optionType} · ${l.expiry} · ${timing}`;
    }
    case 'combined':
      return `${instrument} ${cd.template ?? 'custom'} · summed premium of ${cd.legs.length} legs`;
  }
}
