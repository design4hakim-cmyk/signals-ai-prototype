import { create } from 'zustand';
import { INDEXES, SAVED_STRATEGIES, type SavedStrategy } from '@/mock/savedStrategies';
import { emaNow } from '@/mock/chats';
import { complexStrategy, demoStrategy, emptyStrategy, groupedStrategy } from '@/mock/strategies';
import { useBacktest } from './backtest';
import { useCanvas } from './canvas';
import { useCopilot } from './copilot';
import { useStrategy, type RunningTrade } from './strategy';
import { useWorkspace } from './workspace';

/*
  Library store = the saved strategies in the My Strategies panel (design/strategies-panel).
    • which one is open in the builder (its row turns blue)
    • panel mode: closed · peek (floats on hovering the folder) · pinned (beside the builder)
    • rename (unique per index, never empty), duplicate, delete (blocked while running)
    • Trade adds a live trade or forward test; counts update everywhere at once
  The open strategy stays in sync with the builder: its name and running trades
  live in the strategy store, and changes there flow back here.
*/

export type PanelMode = 'closed' | 'peek' | 'pinned';
export type TradeKind = 'live' | 'forward';

interface PanelToast {
  text: string;
  undo?: () => void;
}

interface LibraryState {
  strategies: SavedStrategy[];
  openId: string | null;
  mode: PanelMode;
  expanded: string[]; // index symbols open in the panel
  query: string;
  loading: boolean;
  renamingId: string | null;
  confirmDeleteId: string | null;
  menuId: string | null; // whose ⋯ menu is open
  tradeFor: { id: string | null; name: string } | null; // Trade popup target (null id = the builder's own strategy)
  toast: PanelToast | null;

  setMode: (m: PanelMode) => void;
  toggleIndex: (symbol: string, open?: boolean) => void;
  setQuery: (q: string) => void;
  openStrategy: (id: string) => void;
  newStrategy: () => void;
  /** returns an error message, or null when saved */
  rename: (id: string, name: string) => string | null;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  trade: (target: { id: string | null; name: string }, kind: TradeKind, setups: string[]) => void;
  set: (patch: Partial<LibraryState>) => void;
}

let n = 0;
const uid = () => `s-${Date.now().toString(36)}-${++n}`;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let loadedOnce = false;

/** Why a name can't be used, or null. Names are unique within an index. */
export function nameError(list: SavedStrategy[], id: string, name: string): string | null {
  const s = list.find((x) => x.id === id);
  const clean = name.trim();
  if (!clean) return "Name can't be empty";
  if (s && list.some((x) => x.id !== id && x.indexSymbol === s.indexSymbol && x.name.trim().toLowerCase() === clean.toLowerCase()))
    return `A ${s.indexSymbol} strategy already has this name`;
  return null;
}

/** Running trades for the builder's top nav, made from counts. */
const mockTrades = (kind: TradeKind, count: number, setups: string[] = []): RunningTrade[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${kind}-${Date.now().toString(36)}-${i}-${++n}`,
    setup: setups[i] ?? ['Iron Condor', 'Bull Call Spread', 'Short Straddle'][i % 3],
    ...(kind === 'live' ? { broker: 'Broker ••42' } : {}),
    pnl: [2400, -900, 1350, 620][i % 4],
    status: 'Running' as const,
  }));

export const useLibrary = create<LibraryState>((set, get) => {
  const toast = (text: string, undo?: () => void) => {
    clearTimeout(toastTimer);
    set({ toast: { text, undo } });
    toastTimer = setTimeout(() => set({ toast: null }), 6000);
  };
  const patch = (id: string, p: Partial<SavedStrategy>) =>
    set((s) => ({ strategies: s.strategies.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  return {
    strategies: SAVED_STRATEGIES,
    openId: null,
    mode: 'closed',
    expanded: ['SENSEX'],
    query: '',
    loading: false,
    renamingId: null,
    confirmDeleteId: null,
    menuId: null,
    tradeFor: null,
    toast: null,

    setMode: (mode) => {
      // the first time the panel opens, the list loads (skeleton rows)
      if (mode !== 'closed' && !loadedOnce) {
        loadedOnce = true;
        set({ loading: true });
        setTimeout(() => set({ loading: false }), 700);
      }
      set({ mode, menuId: null, confirmDeleteId: null });
    },
    toggleIndex: (symbol, open) =>
      set((s) => {
        const isOpen = s.expanded.includes(symbol);
        const want = open ?? !isOpen;
        return { expanded: want ? (isOpen ? s.expanded : [...s.expanded, symbol]) : s.expanded.filter((x) => x !== symbol) };
      }),
    setQuery: (query) => set({ query }),

    // Open in builder: the row turns blue; a peeking panel closes, a pinned one stays
    openStrategy: (id) => {
      const s = get().strategies.find((x) => x.id === id);
      if (!s) return;
      set((st) => ({ openId: id, mode: st.mode === 'peek' ? 'closed' : st.mode, menuId: null, renamingId: null }));
      useStrategy.setState({
        name: s.name,
        saved: true,
        dirty: false,
        saveStatus: 'idle',
        entry: 'complete',
        mode: 'build',
        liveTrades: mockTrades('live', s.live),
        forwardTests: mockTrades('forward', s.forwardTests),
        savedNames: get().strategies.filter((x) => x.id !== id).map((x) => x.name),
      });
      // its blocks go on the canvas, and its saved setups come with results already run
      const trees = [demoStrategy, groupedStrategy, complexStrategy];
      useCanvas.setState({ codeOnly: false });
      // EMA 9/21 is the boards' strategy: RSI 55, volume filter dropped since its last chat
      useCanvas.getState().load(id === 's-ema' ? emaNow() : trees[Math.max(0, get().strategies.findIndex((x) => x.id === id)) % trees.length]());
      // Copilot opens this strategy's last chat, scrolled to the end (design/copilot/CONVERSATIONS.md)
      useCopilot.getState().openStrategy(id);
      const bt = useBacktest.getState();
      bt.set({ setups: [], strategyChange: null, run: null });
      bt.addSaved(['saved-ss', 'saved-ic']);
      bt.seedResults();
    },

    newStrategy: () => {
      set((st) => ({ openId: null, mode: st.mode === 'peek' ? 'closed' : st.mode }));
      useStrategy.setState({ ...useStrategy.getInitialState(), savedNames: get().strategies.map((x) => x.name) });
      // a new strategy starts a new empty chat; the old one keeps its chats
      useCopilot.getState().openStrategy(`untitled-${uid()}`);
      useCanvas.setState({ codeOnly: false });
      useCanvas.getState().load(emptyStrategy());
      useBacktest.getState().set({ setups: [], activeId: 'compare', strategyChange: null, run: null });
    },

    rename: (id, name) => {
      const err = nameError(get().strategies, id, name);
      if (err) return err;
      const before = get().strategies.find((x) => x.id === id)!.name;
      const clean = name.trim();
      set({ renamingId: null });
      if (clean === before) return null;
      patch(id, { name: clean, updatedAt: Date.now() });
      // the builder's title follows at once (unsaved canvas changes are untouched)
      if (get().openId === id) useStrategy.setState({ name: clean });
      toast(`Renamed to “${clean}”`, () => {
        patch(id, { name: before });
        if (get().openId === id) useStrategy.setState({ name: before });
        set({ toast: null });
      });
      return null;
    },

    duplicate: (id) => {
      const s = get().strategies.find((x) => x.id === id);
      if (!s) return;
      const taken = new Set(get().strategies.filter((x) => x.indexSymbol === s.indexSymbol).map((x) => x.name.toLowerCase()));
      let name = `${s.name} copy`;
      for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${s.name} copy ${i}`;
      const copy: SavedStrategy = { ...s, id: uid(), name, updatedAt: Date.now(), live: 0, forwardTests: 0 };
      set((st) => ({ strategies: [copy, ...st.strategies], menuId: null, expanded: st.expanded.includes(s.indexSymbol) ? st.expanded : [...st.expanded, s.indexSymbol] }));
      // notes are copied (not the chats), and the copy knows where it came from
      useCopilot.getState().copyNotes(id, copy.id, s.name);
      toast(`Duplicated as “${name}”`);
    },

    // Blocked while anything runs (the ⋯ menu says why); the confirm happens in the panel
    remove: (id) => {
      const s = get().strategies.find((x) => x.id === id);
      if (!s || s.live + s.forwardTests > 0) return;
      const wasOpen = get().openId === id;
      set((st) => ({ strategies: st.strategies.filter((x) => x.id !== id), confirmDeleteId: null, menuId: null, openId: wasOpen ? null : st.openId }));
      // its Copilot chats and notes go too (the confirm says so)
      useCopilot.getState().forgetStrategy(id);
      if (wasOpen) useCopilot.getState().openStrategy(null);
      // deleting the open strategy leaves the builder with a fresh, untitled one
      if (wasOpen) useStrategy.setState({ ...useStrategy.getInitialState(), savedNames: get().strategies.map((x) => x.name) });
      toast(`Deleted “${s.name}”`);
    },

    // Works for one that already runs too: it adds one more per setup
    trade: (target, kind, setups) => {
      const count = Math.max(1, setups.length);
      const isBuilder = target.id === null || target.id === get().openId;
      if (isBuilder) {
        const st = useStrategy.getState();
        const extra = mockTrades(kind, count, setups);
        useStrategy.setState(kind === 'live' ? { liveTrades: [...st.liveTrades, ...extra] } : { forwardTests: [...st.forwardTests, ...extra] });
      } else {
        const s = get().strategies.find((x) => x.id === target.id);
        if (s) patch(s.id, kind === 'live' ? { live: s.live + count } : { forwardTests: s.forwardTests + count });
      }
      set({ tradeFor: null });
      const text = `${kind === 'live' ? 'Live trade' : 'Forward test'}${count > 1 ? `s (${count})` : ''} started · ${target.name}`;
      // one confirmation: in the panel when it's showing, otherwise at the bottom of the app
      if (get().mode === 'closed') useStrategy.getState().showToast(text);
      else toast(text);
    },

    set: (p) => set(p),
  };
});

/*
  Keep the open strategy and the builder in step:
    • running trades started or stopped in the top nav → the chips here update
    • renamed in the top nav → the row here updates
    • saved for the first time in the builder → it joins the list, open
*/
useStrategy.subscribe((s, prev) => {
  const lib = useLibrary.getState();
  const openId = lib.openId;
  if (openId && (s.liveTrades !== prev.liveTrades || s.forwardTests !== prev.forwardTests || s.name !== prev.name)) {
    useLibrary.setState({
      strategies: lib.strategies.map((x) =>
        x.id === openId ? { ...x, live: s.liveTrades.length, forwardTests: s.forwardTests.length, ...(s.name ? { name: s.name } : {}) } : x,
      ),
    });
  }
  if (!openId && s.saved && !prev.saved && s.name) {
    const instrument = useWorkspace.getState().instrument;
    const symbol = instrument === 'BTCUSD' ? 'BTC' : instrument;
    const id = uid();
    useLibrary.setState({
      openId: id,
      strategies: [{ id, name: s.name, indexSymbol: symbol, updatedAt: Date.now(), live: 0, forwardTests: 0 }, ...lib.strategies],
      expanded: lib.expanded.includes(symbol) ? lib.expanded : [...lib.expanded, symbol],
    });
  }
});

/** Index rows to show: known indexes first (panel order), then any others the list uses. */
export function indexOrder(list: SavedStrategy[]) {
  const known = INDEXES.map((i) => i.symbol);
  const extra = [...new Set(list.map((s) => s.indexSymbol))].filter((x) => !known.includes(x));
  return [...known, ...extra].filter((sym) => list.some((s) => s.indexSymbol === sym));
}
