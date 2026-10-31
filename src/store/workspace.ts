import { create } from 'zustand';
import type { ChartData, Instrument, Period, Timeframe } from '@/types/market';
import { unavailableReason } from '@/mock/instruments';

/*
  Zustand store = the shared "state" of the workspace.
  Any component can read from it or change it, and every component
  that uses that value redraws automatically.
  Think of it as the prototype's variables in Figma, but live.
*/

interface WorkspaceState {
  strategyName: string;
  instrument: Instrument;
  chartData: ChartData;
  timeframe: Timeframe;
  period: Period;
  bottomTab: 'chart' | 'logs';
  chartCollapsed: boolean;

  setInstrument: (v: Instrument) => void;
  setChartData: (v: ChartData) => void;
  setTimeframe: (v: Timeframe) => void;
  setBottomTab: (v: 'chart' | 'logs') => void;
  toggleChart: () => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  strategyName: 'New Strategy',
  instrument: 'NIFTY',
  chartData: { kind: 'spot' },
  timeframe: '15m',
  period: '1Y',
  bottomTab: 'chart',
  chartCollapsed: false,

  // Switching instrument keeps the chart data unless the new instrument
  // can't use it (e.g. Perpetual on NIFTY) — then we fall back to Spot.
  setInstrument: (instrument) =>
    set((s) => ({
      instrument,
      chartData: unavailableReason(s.chartData.kind, instrument) ? { kind: 'spot' } : s.chartData,
    })),
  setChartData: (chartData) => set({ chartData }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  toggleChart: () => set((s) => ({ chartCollapsed: !s.chartCollapsed })),
}));
