import { create } from 'zustand';
import type { ChartData, Instrument, Period, Timeframe } from '@/types/market';

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
  setTimeframe: (v: Timeframe) => void;
  setBottomTab: (v: 'chart' | 'logs') => void;
  toggleChart: () => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  strategyName: 'New Strategy',
  instrument: 'NIFTY',
  chartData: 'SPOT',
  timeframe: '15m',
  period: '1Y',
  bottomTab: 'chart',
  chartCollapsed: false,

  setInstrument: (instrument) => set({ instrument }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  toggleChart: () => set((s) => ({ chartCollapsed: !s.chartCollapsed })),
}));
