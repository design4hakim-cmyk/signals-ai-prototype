import { create } from 'zustand';
import { useWorkspace } from './workspace';
import { useBacktest } from './backtest';

/*
  Strategy store = the strategy's life: name, saved or not, edited since,
  which mode we're in, and any trades it's running (Top nav sheet, stages A–L).
*/

export type EntryState = 'empty' | 'partial' | 'complete';
export type SaveStatus = 'idle' | 'naming' | 'saving' | 'error';

export interface RunningTrade {
  id: string;
  setup: string;
  broker?: string; // live only
  pnl: number; // today's P&L in ₹
  status: 'Running' | 'Paused';
}

interface StrategyState {
  name: string | null; // null = Untitled
  saved: boolean;
  dirty: boolean; // saved, then edited
  saveStatus: SaveStatus;
  entry: EntryState;
  noSignals: boolean; // scenario helper: a strategy that never fires
  mode: 'build' | 'backtest';
  forwardTests: RunningTrade[];
  liveTrades: RunningTrade[];
  savedNames: string[]; // other strategies, for the duplicate-name check
  toast: string | null;

  startNaming: () => void;
  cancelNaming: () => void;
  save: (name?: string) => void; // first save (with name) or Update
  rename: (name: string) => void;
  discard: () => void;
  edit: (description: string) => void; // any change on Build
  setMode: (m: 'build' | 'backtest') => void;
  showToast: (t: string) => void;
  set: (patch: Partial<StrategyState>) => void;
}

export const useStrategy = create<StrategyState>((set, get) => ({
  name: null,
  saved: false,
  dirty: false,
  saveStatus: 'idle',
  entry: 'empty',
  noSignals: false,
  mode: 'build',
  forwardTests: [],
  liveTrades: [],
  savedNames: ['NIFTY Momentum Breakout', 'BANKNIFTY Opening Range Breakout with VWAP filter', 'FINNIFTY Gap Fade'],
  toast: null,

  startNaming: () => set({ saveStatus: 'naming' }),
  cancelNaming: () => set({ saveStatus: 'idle' }),

  save: (name) => {
    set({ saveStatus: 'saving', ...(name ? { name } : {}) });
    setTimeout(() => {
      // a name containing "fail" simulates "Couldn't save" for review
      if ((get().name ?? '').toLowerCase().includes('fail')) return set({ saveStatus: 'error' });
      set({ saveStatus: 'idle', saved: true, dirty: false });
    }, 700);
  },
  rename: (name) => set({ name }),
  discard: () => {
    set({ dirty: false });
    get().showToast('Back to the last saved version');
  },

  edit: (description) => {
    const s = get();
    set({ dirty: s.saved ? true : s.dirty });
    useWorkspace.getState().strategyEdited();
    useBacktest.getState().strategyChanged(description);
  },

  setMode: (mode) => set({ mode }),
  showToast: (toast) => {
    set({ toast });
    setTimeout(() => get().toast === toast && set({ toast: null }), 3500);
  },
  set: (patch) => set(patch),
}));
