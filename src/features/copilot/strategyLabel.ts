import { useLibrary } from '@/store/library';

/** The strategy's name and index, for labels ("RSI Dip · NIFTY"). */
export function strategyLabel(strategyId: string | null) {
  const s = useLibrary.getState().strategies.find((x) => x.id === strategyId);
  return s ? { name: s.name, index: s.indexSymbol } : { name: strategyId ? 'Untitled strategy' : 'No strategy', index: '' };
}

