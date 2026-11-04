import { create } from 'zustand';

/*
  Results view store = how you're looking at the backtest results, not the results themselves.
  Nothing here re-runs the backtest: the VIX filter only narrows which trades count.
*/

export type SortKey = 'date' | 'pnl' | 'vix';
export type McState = { phase: 'idle' } | { phase: 'running'; done: number } | { phase: 'result'; sorted: number[] };

interface ResultsViewState {
  /** applied VIX range; null = all trades */
  vix: [number, number] | null;
  vixOpen: boolean;
  /** in/out-of-sample split, and whether the chart shows it */
  split: number;
  splitOnChart: boolean;
  confidence: number;
  mc: McState;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  sortOpen: boolean;
  page: number;
  expanded: number[]; // trade numbers showing their legs
  /** Scenarios: show the chart tooltip / a heatmap tooltip without hovering */
  hoverDate: string | null;
  hoverCell: { year: number; month: number } | null;

  set: (p: Partial<ResultsViewState>) => void;
  toggleTrade: (n: number) => void;
  reset: () => void;
}

const initial = {
  vix: null,
  vixOpen: false,
  split: 0.7,
  splitOnChart: false,
  confidence: 95,
  mc: { phase: 'idle' } as McState,
  sort: { key: 'date' as SortKey, dir: 'asc' as const },
  sortOpen: false,
  page: 1,
  expanded: [1, 4],
  hoverDate: null,
  hoverCell: null,
};

export const useResultsView = create<ResultsViewState>((set) => ({
  ...initial,
  set: (p) => set(p),
  toggleTrade: (n) => set((s) => ({ expanded: s.expanded.includes(n) ? s.expanded.filter((x) => x !== n) : [...s.expanded, n] })),
  reset: () => set(initial),
}));
