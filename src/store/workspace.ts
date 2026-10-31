import { create } from 'zustand';
import type { ChartData, Instrument, Period, Timeframe } from '@/types/market';
import { unavailableReason } from '@/mock/instruments';
import type { Limits } from '@/lib/signals';

/*
  Workspace store = what we trade + what the chart shows.

  Key rule from the bottom-bar sheet (K12):
  any change to instrument, chart data, timeframe, period or the strategy
  PAUSES the chart. Nothing recalculates by itself — the user presses
  "Update chart". So we keep two copies:
    • the current choices (what the bar shows)
    • `applied` (what the chart was last drawn with)
  Limits are different: they apply right away.
*/

export interface ChartInputs {
  instrument: Instrument;
  chartData: ChartData;
  timeframe: Timeframe;
  period: Period;
  strategyVersion: number; // bumps on every strategy edit
}

export type ChartStatus = 'current' | 'updating' | 'updated' | 'error';

interface WorkspaceState extends ChartInputs {
  applied: ChartInputs;
  pendingChanges: number;
  chartStatus: ChartStatus;
  /** counts before the last update, for the +12 change pills */
  previousCounts: { entries: number; exits: number } | null;
  failNextUpdate: boolean; // scenario helper: show "Couldn't update"
  limits: Limits;

  bottomTab: 'chart' | 'signals';
  panelOpen: boolean;

  setInstrument: (v: Instrument) => void;
  setChartData: (v: ChartData) => void;
  setTimeframe: (v: Timeframe) => void;
  setPeriod: (v: Period) => void;
  strategyEdited: (changes?: number) => void;
  updateChart: (current: { entries: number; exits: number }) => void;
  setLimits: (l: Partial<Limits>) => void;
  setBottomTab: (t: 'chart' | 'signals') => void;
  togglePanel: () => void;
  set: (patch: Partial<WorkspaceState>) => void;
}

const initial: ChartInputs = {
  instrument: 'NIFTY',
  chartData: { kind: 'spot' },
  timeframe: '15m',
  period: '1Y',
  strategyVersion: 1,
};

const inputsOf = (s: ChartInputs): ChartInputs => ({
  instrument: s.instrument,
  chartData: s.chartData,
  timeframe: s.timeframe,
  period: s.period,
  strategyVersion: s.strategyVersion,
});

export const useWorkspace = create<WorkspaceState>((set, get) => {
  /** Every input change goes through here: change it, and pause the chart. */
  const change = (patch: Partial<ChartInputs>) =>
    set((s) => ({ ...patch, pendingChanges: s.pendingChanges + 1, chartStatus: 'current', previousCounts: null }));

  return {
    ...initial,
    applied: initial,
    pendingChanges: 0,
    chartStatus: 'current',
    previousCounts: null,
    failNextUpdate: false,
    limits: { openAtOnce: 1, perDay: 3 },
    bottomTab: 'chart',
    panelOpen: true,

    // Switching instrument keeps chart data unless it can't be used (Perpetual on NIFTY → Spot)
    setInstrument: (instrument) =>
      change({
        instrument,
        chartData: unavailableReason(get().chartData.kind, instrument) ? { kind: 'spot' } : get().chartData,
      }),
    setChartData: (chartData) => change({ chartData }),
    setTimeframe: (timeframe) => change({ timeframe }),
    setPeriod: (period) => change({ period }),
    strategyEdited: (changes = 1) =>
      set((s) => ({
        strategyVersion: s.strategyVersion + 1,
        pendingChanges: s.pendingChanges + changes,
        chartStatus: 'current',
        previousCounts: null,
      })),

    updateChart: (current) => {
      set({ chartStatus: 'updating' });
      setTimeout(() => {
        if (get().failNextUpdate) {
          set({ chartStatus: 'error', failNextUpdate: false });
          return;
        }
        set((s) => ({ applied: inputsOf(s), pendingChanges: 0, chartStatus: 'updated', previousCounts: current }));
        // change pills fade after a few seconds
        setTimeout(() => get().chartStatus === 'updated' && set({ chartStatus: 'current' }), 4000);
      }, 1400);
    },

    setLimits: (l) => set((s) => ({ limits: { ...s.limits, ...l } })),
    setBottomTab: (bottomTab) => set({ bottomTab, panelOpen: true }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    set: (patch) => set(patch),
  };
});
