import { create } from 'zustand';
import { useWorkspace } from './workspace';

/*
  Backtest store = the setup block (SetupBlock-Unified sheet).
  Five layers, each owning one job:
    1 Tab row   → which setup, and Run
    2 Status    → why (only when something needs saying)
    3 Header    → what it is + Save as setup / Update setup
    4 Body      → the inputs
    5 Results   → the answer
  Two separate questions never share a button:
    "Are results current?" (run)  vs  "Is this setup saved?" (save)
*/

export type SetupStatus = 'blank' | 'current' | 'outdated' | 'running' | 'queued' | 'failed';

export interface SetupLeg {
  id: string;
  position: 'BUY' | 'SELL';
  segment: 'Options' | 'Futures';
  type: 'CE' | 'PE';
  strike: string; // '' = not picked yet
  expiry: 'Weekly' | 'Monthly';
  lots: number;
}

export interface SetupConfig {
  index: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'SENSEX';
  underlying: 'Cash' | 'Futures';
  holding: 'Intraday' | 'BTST' | 'Positional';
  entryAt: string;
  exitAt: string;
  squareOff: 'Partial' | 'Complete';
  legs: SetupLeg[];
  sl: { on: boolean; amount: number };
  target: { on: boolean; amount: number };
}

export interface Results {
  netPnl: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
}

export interface Setup extends SetupConfig {
  id: string;
  name: string;
  savedId: string | null; // linked saved setup, if any
  editedSinceSave: boolean;
  status: SetupStatus;
  everRun: boolean;
  results: Results | null;
  previous: Results | null; // for change pills after an update
  expanded: boolean;
  newerSavedVersion: boolean;
  error: { reason: string } | null;
}

export interface SavedSetup extends SetupConfig {
  id: string;
  name: string;
  summary: string;
}

interface BacktestState {
  setups: Setup[];
  activeId: string | 'compare';
  saved: SavedSetup[];
  /** why every tab is outdated (a change on Build), shown in the status strip */
  strategyChange: string | null;
  run: { total: number; done: number; queue: string[] } | null;
  failSetupName: string | null; // scenario helper: this setup fails on the next run

  select: (id: string | 'compare') => void;
  addBlank: () => void;
  addSaved: (ids: string[]) => void;
  remove: (id: string) => void;
  edit: (id: string, patch: Partial<SetupConfig>) => void;
  toggleExpanded: (id: string) => void;
  saveAsSetup: (id: string, name?: string) => void;
  updateSaved: (id: string) => void;
  renameSetup: (id: string, name: string) => void;
  duplicate: (id: string) => void;
  takeNewerVersion: (id: string) => void;
  strategyChanged: (description: string) => void;
  runBacktests: () => void;
  cancelRun: () => void;
  seedResults: () => void; // scenario helper: every complete setup → current, instantly
  set: (patch: Partial<BacktestState>) => void;
}

/* ── helpers ─────────────────────────────────────────────────── */

let n = 0;
const uid = (p: string) => `${p}-${++n}`;
const leg = (position: SetupLeg['position'], type: SetupLeg['type'], strike: string, lots = 1): SetupLeg => ({
  id: uid('leg'), position, segment: 'Options', type, strike, expiry: 'Weekly', lots,
});

const base: Omit<SetupConfig, 'legs'> = {
  index: 'NIFTY', underlying: 'Cash', holding: 'Intraday', entryAt: '09:35', exitAt: '15:14',
  squareOff: 'Partial', sl: { on: true, amount: 3000 }, target: { on: true, amount: 6000 },
};

export const SAVED_LIBRARY: SavedSetup[] = [
  { ...base, id: 'saved-ic', name: 'Iron Condor', summary: 'NIFTY · Intraday · 4 legs',
    legs: [leg('SELL', 'CE', 'ATM'), leg('SELL', 'PE', 'ATM'), leg('BUY', 'CE', 'OTM4'), leg('BUY', 'PE', 'OTM4')] },
  { ...base, id: 'saved-bcs', name: 'Bull Call Spread', summary: 'NIFTY · Positional · 2 legs',
    holding: 'Positional', entryAt: '09:20', exitAt: '15:20', sl: { on: true, amount: 2500 }, target: { on: true, amount: 5000 },
    legs: [leg('BUY', 'CE', 'ATM'), leg('SELL', 'CE', 'OTM2')] },
  { ...base, id: 'saved-ss', name: 'Short Straddle', summary: 'NIFTY · Intraday · 2 legs',
    entryAt: '09:20', exitAt: '15:15', sl: { on: true, amount: 4000 }, target: { on: false, amount: 8000 },
    legs: [leg('SELL', 'CE', 'ATM'), leg('SELL', 'PE', 'ATM')] },
  { ...base, id: 'saved-lp', name: 'Long Put', summary: 'NIFTY · Intraday · 1 leg', legs: [leg('BUY', 'PE', 'ATM')] },
];

const fromSaved = (s: SavedSetup): Setup => ({
  ...structuredClone(s), id: uid('setup'), savedId: s.id, editedSinceSave: false, status: 'blank',
  everRun: false, results: null, previous: null, expanded: false, newerSavedVersion: false, error: null,
});

const blank = (): Setup => ({
  ...base, legs: [leg('SELL', 'CE', '')], id: uid('setup'), name: 'New Trade', savedId: null,
  editedSinceSave: false, status: 'blank', everRun: false, results: null, previous: null,
  expanded: true, newerSavedVersion: false, error: null,
});

/** Setup is complete when every leg has a strike. Run stays locked until then. */
export const isComplete = (s: SetupConfig) => s.legs.length > 0 && s.legs.every((l) => l.strike !== '');

/** Believable, repeatable results from the setup + strategy + period. */
function mockResults(s: Setup): Results {
  const w = useWorkspace.getState();
  const key = JSON.stringify([s.legs.map((l) => [l.position, l.type, l.strike, l.lots]), s.holding, s.sl, s.target, w.period, w.strategyVersion, s.index]);
  let h = 7;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (k: number) => ((h >>> k) % 1000) / 1000;
  return {
    netPnl: Math.round((90000 + r(1) * 180000) / 50) * 50,
    maxDrawdown: Math.round((22000 + r(5) * 26000) / 10) * 10,
    winRate: Math.round(48 + r(9) * 18),
    trades: Math.round(200 + r(13) * 70),
  };
}

const RUN_MS = 1600;

/* ── store ───────────────────────────────────────────────────── */

export const useBacktest = create<BacktestState>((set, get) => {
  const patchSetup = (id: string, patch: Partial<Setup>) =>
    set((s) => ({ setups: s.setups.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  /** Run the queue one by one; the open tab goes first. */
  const runNext = () => {
    const st = get();
    if (!st.run) return;
    const [nextId, ...rest] = st.run.queue;
    if (!nextId) {
      set({ run: null, strategyChange: st.setups.some((x) => x.status === 'outdated') ? st.strategyChange : null });
      return;
    }
    patchSetup(nextId, { status: 'running' });
    setTimeout(() => {
      const cur = get();
      if (!cur.run) return; // cancelled
      const setup = cur.setups.find((x) => x.id === nextId);
      if (setup) {
        if (cur.failSetupName && setup.name === cur.failSetupName) {
          patchSetup(nextId, {
            status: 'failed',
            error: { reason: 'Weekly option data for NIFTY starts in Mar 2024; this Period begins Jan 2024.' },
          });
          set({ failSetupName: null });
        } else {
          patchSetup(nextId, {
            status: 'current', everRun: true, previous: setup.results, results: mockResults(setup),
            expanded: false, error: null, // auto-collapses after a run
          });
        }
      }
      set((s) => ({ run: s.run && { ...s.run, done: s.run.done + 1, queue: rest } }));
      runNext();
    }, RUN_MS);
  };

  return {
    setups: [],
    activeId: 'compare',
    saved: SAVED_LIBRARY,
    strategyChange: null,
    run: null,
    failSetupName: null,

    select: (activeId) => set({ activeId }),
    addBlank: () => {
      const s = blank();
      set((st) => ({ setups: [...st.setups, s], activeId: s.id }));
    },
    addSaved: (ids) => {
      const add = ids.map((id) => fromSaved(get().saved.find((x) => x.id === id)!));
      set((st) => ({ setups: [...st.setups, ...add], activeId: add[0]?.id ?? st.activeId }));
    },
    remove: (id) =>
      set((st) => {
        const setups = st.setups.filter((x) => x.id !== id);
        return { setups, activeId: st.activeId === id ? (setups[0]?.id ?? 'compare') : st.activeId };
      }),

    // Editing a setup outdates only THIS tab, and (if it's linked to a saved setup) offers Update setup.
    edit: (id, patch) => {
      const s = get().setups.find((x) => x.id === id);
      if (!s) return;
      patchSetup(id, {
        ...patch,
        editedSinceSave: s.savedId ? true : s.editedSinceSave,
        status: s.everRun ? 'outdated' : 'blank',
        newerSavedVersion: false,
      });
    },
    toggleExpanded: (id) => {
      const s = get().setups.find((x) => x.id === id);
      if (s) patchSetup(id, { expanded: !s.expanded });
    },

    saveAsSetup: (id, name) => {
      const s = get().setups.find((x) => x.id === id);
      if (!s) return;
      const savedId = uid('saved');
      const finalName = name ?? (s.name === 'New Trade' ? `Setup ${get().saved.length + 1}` : s.name);
      const copy: SavedSetup = {
        ...structuredClone(s), id: savedId, name: finalName,
        summary: `${s.index} · ${s.holding} · ${s.legs.length} leg${s.legs.length > 1 ? 's' : ''}`,
      };
      set((st) => ({ saved: [...st.saved, copy] }));
      patchSetup(id, { savedId, name: finalName, editedSinceSave: false });
    },
    updateSaved: (id) => {
      const s = get().setups.find((x) => x.id === id);
      if (!s?.savedId) return;
      set((st) => ({ saved: st.saved.map((x) => (x.id === s.savedId ? { ...x, ...structuredClone(s), id: x.id } : x)) }));
      patchSetup(id, { editedSinceSave: false });
    },
    renameSetup: (id, name) => patchSetup(id, { name }),
    duplicate: (id) => {
      const s = get().setups.find((x) => x.id === id);
      if (!s) return;
      const copy: Setup = { ...structuredClone(s), id: uid('setup'), name: `${s.name} copy`, savedId: null, editedSinceSave: false };
      set((st) => ({ setups: [...st.setups, copy], activeId: copy.id }));
    },
    takeNewerVersion: (id) => patchSetup(id, { newerSavedVersion: false, status: 'outdated' }),

    // A change on Build outdates every setup that has run. Old results stay, faded.
    strategyChanged: (description) =>
      set((st) => ({
        strategyChange: st.setups.some((x) => x.everRun) ? description : st.strategyChange,
        setups: st.setups.map((x) => (x.everRun && x.status !== 'blank' ? { ...x, status: 'outdated' } : x)),
      })),

    runBacktests: () => {
      const st = get();
      const needs = st.setups.filter(
        (x) => (x.status === 'outdated' || x.status === 'failed' || x.status === 'blank') && isComplete(x),
      );
      if (!needs.length) return;
      const active = needs.find((x) => x.id === st.activeId);
      const queue = [...(active ? [active.id] : []), ...needs.filter((x) => x !== active).map((x) => x.id)];
      set({
        run: { total: queue.length, done: 0, queue },
        setups: st.setups.map((x) => (queue.includes(x.id) ? { ...x, status: 'queued', error: null } : x)),
      });
      runNext();
    },
    cancelRun: () =>
      set((st) => ({
        run: null,
        setups: st.setups.map((x) =>
          x.status === 'queued' || x.status === 'running' ? { ...x, status: x.everRun ? 'outdated' : 'blank' } : x,
        ),
      })),
    seedResults: () =>
      set((st) => ({
        strategyChange: null,
        run: null,
        setups: st.setups.map((x) =>
          isComplete(x) ? { ...x, status: 'current', everRun: true, results: mockResults(x), previous: null, expanded: false, error: null } : x,
        ),
      })),
    set: (patch) => set(patch),
  };
});

/** Results are current when at least one setup ran and nothing is outdated or running. */
export function resultsCurrent(setups: Setup[]) {
  return setups.length > 0 && setups.every((s) => s.status === 'current');
}
