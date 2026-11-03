import { useState } from 'react';
import { flatConditions } from '@/lib/conditions';
import { complexStrategy, demoStrategy, editingStrategy, groupedStrategy, halfBuiltStrategy } from '@/mock/strategies';
import { SAVED_LIBRARY, useBacktest } from '@/store/backtest';
import { useCanvas, type EditorPart } from '@/store/canvas';
import { useCopilot } from '@/store/copilot';
import { useLibrary } from '@/store/library';
import { ALL_TRADES, monteCarlo, MONTE_CARLO } from '@/lib/backtestData';
import { useResultsView } from '@/store/results';
import { useStrategy } from '@/store/strategy';
import { useWorkspace } from '@/store/workspace';
import type { StrategyTree } from '@/types/strategy';

/*
  PROTOTYPE ONLY — a review helper, not part of the product.
  Jumps the app into states from the boards and component sheets
  (Canvas builder B/E/U, Top nav A–K, Bottom bar 1–12, Setup block 1–9),
  so reviewers don't have to click their way there.
*/

const resetAll = () => {
  useStrategy.setState(useStrategy.getInitialState(), true);
  useWorkspace.setState(useWorkspace.getInitialState(), true);
  useBacktest.setState(useBacktest.getInitialState(), true);
  useCanvas.setState(useCanvas.getInitialState(), true);
  useLibrary.setState(useLibrary.getInitialState(), true);
  useResultsView.getState().reset();
  useCopilot.getState().newChat();
};
const L = () => useLibrary.getState();
const S = () => useStrategy.getState();
const W = () => useWorkspace.getState();
const B = () => useBacktest.getState();
const C = () => useCanvas.getState();

/** Start fresh with these conditions already on the canvas, chart drawn from them. */
const withStrategy = (t: StrategyTree = demoStrategy()) => {
  resetAll();
  C().load(t);
};

/** Find a condition by reading order on a side (1 = first), for opening menus on it. */
const nth = (side: 'entry' | 'exit', n: number) => flatConditions(C()[side])[n - 1].id;
const openOn = (id: string, part: EditorPart) => C().openEditor(id, part);
const EMA9 = { type: 'indicator' as const, id: 'ema' as const, params: { length: 9, source: 'Close' as const, offset: 0 } };

/** A saved strategy with an entry, whose 3 setups are backtested and current. */
const savedWithResults = () => {
  withStrategy();
  S().set({ name: 'NIFTY Momentum Breakout', saved: true });
  B().addSaved(SAVED_LIBRARY.slice(0, 3).map((s) => s.id));
  B().seedResults();
};

/* Copilot: scripted prompts (mock/copilot.ts), run as if typed */
const P = () => useCopilot.getState();
const MAIN = 'Buy when EMA 9 crosses above EMA 21 and RSI is above 50';
const after = (ms: number, f: () => void) => setTimeout(f, ms);
const lastCard = () => [...P().messages].reverse().find((m) => m.kind === 'card')?.id ?? '';

const FWD = [
  { id: 'f1', setup: 'Iron Condor', pnl: 4250, status: 'Running' as const },
  { id: 'f2', setup: 'Long Put', pnl: -1180, status: 'Running' as const },
];
const LIVE = [
  { id: 'l1', setup: 'Iron Condor', broker: 'Broker ••42', pnl: 2900, status: 'Running' as const },
  { id: 'l2', setup: 'Long Put', broker: 'Broker ••42', pnl: -640, status: 'Running' as const },
  { id: 'l3', setup: 'Short Straddle', broker: 'Broker ••42', pnl: 1120, status: 'Paused' as const },
];

/** Backtest tab with Short Straddle (the real run) and Iron Condor, both current. */
const RV = () => useResultsView.getState();
const results = (patch?: (id: string) => void) => {
  resetAll();
  S().set({ entry: 'complete', name: 'Nifty 09:17 Straddle', saved: true, mode: 'backtest' });
  B().addSaved(['saved-ss', 'saved-ic']);
  B().seedResults();
  const ss = B().setups.find((x) => x.name === 'Short Straddle')!;
  B().select(ss.id);
  patch?.(ss.id);
};
const patchSetup = (id: string, p: Partial<ReturnType<typeof B>['setups'][number]>) =>
  B().set({ setups: B().setups.map((x) => (x.id === id ? { ...x, ...p } : x)) });

const GROUPS: { title: string; items: [string, () => void][] }[] = [
  {
    title: 'Canvas builder · by hand (kit)',
    items: [
      ['1 · Empty: + Add Entry Condition', resetAll],
      ['2 · New block, picking indicator', () => { resetAll(); C().addCondition('entry'); }],
      ['3 · Picking the relation', () => { resetAll(); C().addCondition('entry'); C().setOperand(nth('entry', 1), 'left', EMA9); }],
      ['4 · Indicator or value', () => { resetAll(); C().addCondition('entry'); const id = nth('entry', 1); C().setOperand(id, 'left', EMA9); C().setRelation(id, 'Cross Above'); }],
      ['5 · Settings open (apply as you type)', () => { withStrategy(); openOn(nth('entry', 1), 'leftSettings'); }],
      ['6 · Arithmetic open', () => { withStrategy(); openOn(nth('entry', 1), 'rightMath'); }],
      ['7 · Two conditions, root logic menu', () => { withStrategy(); openOn(C().entry.id, 'logic'); }],
      ['8 · Many conditions: All of / Any of / None of', () => withStrategy(complexStrategy())],
      ['9 · Block ⋯ menu', () => { withStrategy(editingStrategy()); openOn(nth('entry', 2), 'more'); }],
      ['10 · Deleted, with Undo', () => { withStrategy(editingStrategy()); C().remove([nth('entry', 2)]); }],
      ['11 · One ticked: siblings can join, rest dims', () => { withStrategy(groupedStrategy()); C().toggleSelect(nth('entry', 3)); }],
      ['12 · Two ticked: group as…', () => { withStrategy(editingStrategy()); C().toggleSelect(nth('entry', 3)); C().toggleSelect(nth('entry', 4)); }],
      ['13 · Grouped, with Undo', () => { withStrategy(editingStrategy()); C().group([nth('entry', 3), nth('entry', 4)], 'OR'); }],
      ['14 · Group ⋯ menu', () => { withStrategy(groupedStrategy()); openOn(C().entry.children[2].id, 'more'); }],
      ['15 · Ready to drag (use ⋮⋮)', () => withStrategy(groupedStrategy())],
      ['16 · Copilot block (✦ until you edit it)', () => { const t = demoStrategy(); const c = t.entry.children[1]; if (c.kind === 'cond') c.copilot = true; withStrategy(t); }],
      ['17 · Editing pauses the chart (changed dots)', () => { withStrategy(); C().setRelation(nth('entry', 2), 'Greater Than or Equal'); C().setMath(nth('entry', 1), 'right', { op: '×', value: 1.01 }); }],
      ['18 · Half built: red field, update blocked', () => { withStrategy(); C().addCondition('entry'); const id = nth('entry', 3); C().setOperand(id, 'left', { type: 'indicator', id: 'price', params: { source: 'Close' } }); C().setRelation(id, 'Cross Above'); C().closeEditor(); }],
      ['19 · Big strategy, zoomed out to 50%', () => { withStrategy(complexStrategy()); C().setView({ x: 0, y: 0, zoom: 0.5 }); }],
      ['20 · Entry section selected (drag title / arrows)', () => { withStrategy(); C().selectFrame('entry'); }],
    ],
  },
  {
    title: 'Copilot (design/copilot)',
    items: [
      ['C1 · Empty, starters', () => resetAll()],
      ['C2 · Understood + exit question (skeletons)', () => { resetAll(); P().send(MAIN); }],
      ['C3 · Strategy ready + next steps', () => { resetAll(); P().send(MAIN); P().answer(lastCard(), 0); }],
      ['C4 · Stopped while building', () => { resetAll(); P().send(MAIN); after(1500, () => P().stop()); }],
      ['C5 · Refine · add (applies at once)', () => { withStrategy(); P().send('Only take trades when volume is above its 20 average'); }],
      ['C6 · Refine · review before changing your blocks', () => { withStrategy(); P().send('Only take trades when volume is above its 20 average'); after(900, () => P().send('Make RSI stricter and drop the volume filter')); }],
      ['C7 · Pine Script · in sync', () => { withStrategy(); P().setView('pine'); }],
      ['C8 · Pine Script · Copilot changed lines', () => { withStrategy(); P().send('Only take trades when volume is above its 20 average'); after(900, () => P().setView('pine')); }],
      ['C9 · Partly fits · fit check', () => { resetAll(); P().send('Enter when RSI crosses above 60 and RSI was below 40 at least once in the last 10 candles'); }],
      ['C10 · Partly fits · custom logic block', () => { resetAll(); P().send('Enter when RSI crosses above 60 and RSI was below 40 at least once in the last 10 candles'); after(900, () => P().buildAnyway(lastCard())); }],
      ['C11 · Code only', () => { resetAll(); P().send('Buy when RSI crosses 70 but re-arm only after it drops below 40'); }],
      ['C12 · Build failed, partly', () => { resetAll(); P().send('Buy above VWAP when RSI crosses 60 and price breaks the upper band, exit at 3:15'); }],
      ['C13 · Vague idea → options', () => { resetAll(); P().send('Make me a profitable strategy'); }],
      ['C14 · Voice · listening', () => { resetAll(); P().set({ listening: true }); }],
    ],
  },
  {
    title: 'My Strategies panel',
    items: [
      ['P1 · Peek (hover the folder icon)', () => { resetAll(); L().setMode('peek'); }],
      ['P2 · Pinned beside the builder', () => { resetAll(); L().setMode('pinned'); }],
      ['P3 · Pinned, Bull Call Spread open', () => { resetAll(); L().setMode('pinned'); L().openStrategy('s-bcs'); }],
      ['P4 · Open, with unsaved changes', () => { resetAll(); L().setMode('pinned'); L().openStrategy('s-bcs'); S().edit('changed RSI (14) > 50 → 60 in Entry'); }],
      ['P5 · Search “rsi”', () => { resetAll(); L().setMode('pinned'); L().setQuery('rsi'); }],
      ['P6 · No results', () => { resetAll(); L().setMode('pinned'); L().setQuery('xyz'); }],
      ['P7 · Empty', () => { resetAll(); L().set({ strategies: [] }); L().setMode('pinned'); }],
      ['P8 · Renaming (try Iron Condor)', () => { resetAll(); L().setMode('pinned'); L().set({ renamingId: 's-bps', loading: false }); }],
      ['P9 · Delete confirm', () => { resetAll(); L().setMode('pinned'); L().set({ confirmDeleteId: 's-bps', loading: false }); }],
      ['P10 · Running: delete blocked', () => { resetAll(); L().setMode('pinned'); L().set({ menuId: 's-bcs', loading: false }); }],
      ['P11 · Trade popup', () => { resetAll(); L().setMode('pinned'); L().set({ loading: false, tradeFor: { id: 's-bps', name: 'Bear Put Spread' } }); }],
      ['P12 · GROWW: delete its last strategy', () => { resetAll(); L().setMode('pinned'); L().set({ expanded: ['GROWW'], confirmDeleteId: 's-groww-orb', loading: false }); }],
    ],
  },
  {
    title: 'Backtest results (BT-Results-States)',
    items: [
      ['R1 · Full results page', () => results()],
      ['R2 · Running (skeleton + progress)', () => results((id) => patchSetup(id, { status: 'running' }))],
      ['R3 · Out of date (faded + Update backtest)', () => { results(); S().edit('changed RSI (14) > 50 → 60 in Entry'); }],
      ['R4 · No trades in this period', () => results((id) => patchSetup(id, { results: { netPnl: 0, maxDrawdown: 0, winRate: 0, trades: 0, noTrades: true } }))],
      ['R5 · Failed, partial results kept', () => results((id) => patchSetup(id, { status: 'failed', error: { reason: 'data for 12 Mar 2026 is missing. Results stop at 11 Mar.', partialUntil: '2026-03-11' } }))],
      ['R6 · VIX filter open', () => { results(); RV().set({ vixOpen: true }); }],
      ['R7 · VIX 12 – 20 applied (158 trades)', () => { results(); RV().set({ vix: [12, 20] }); }],
      ['R8 · Equity curve hover (20 Apr 2026)', () => { results(); setTimeout(() => RV().set({ hoverDate: '2026-04-20' }), 300); }],
      ['R9 · Out-of-sample shown on the chart', () => { results(); RV().set({ splitOnChart: true }); }],
      ['R10 · Heatmap hover (April 2026)', () => { results(); RV().set({ hoverCell: { year: 2026, month: 3 } }); }],
      ['R11 · Monte Carlo running', () => { results(); RV().set({ mc: { phase: 'running', done: 6200 } }); }],
      ['R12 · Monte Carlo result', () => {
        results();
        void monteCarlo(ALL_TRADES, MONTE_CARLO.simulations, () => {}).then((sorted) => sorted && RV().set({ mc: { phase: 'result', sorted } }));
      }],
      ['R13 · Trades collapsed, sort menu open', () => { results(); RV().set({ expanded: [], sortOpen: true }); }],
      ['R14 · Trades sorted by P&L, worst first', () => { results(); RV().set({ sort: { key: 'pnl', dir: 'asc' }, expanded: [] }); }],
      ['R15 · After an update (change pills)', () => results((id) => patchSetup(id, { previous: { netPnl: -31200, winRate: 45.2, maxDrawdown: -55400, trades: 246 } }))],
    ],
  },
  {
    title: 'Top nav · through the flow',
    items: [
      ['A · New, empty', resetAll],
      ['B · Building, half-done', () => withStrategy(halfBuiltStrategy())],
      ['C · Ready, not saved', () => withStrategy()],
      ['E · Saved', () => { withStrategy(); S().set({ name: 'NIFTY Momentum Breakout', saved: true }); }],
      ['F · Saved, then edited', () => { withStrategy(); S().set({ name: 'NIFTY Momentum Breakout', saved: true }); S().edit('changed RSI (14) > 50 → 60 in Entry'); }],
      ['H · Backtest results current', savedWithResults],
      ['I · Edited after backtest', () => { savedWithResults(); S().edit('added Volume > SMA (20) to Entry'); }],
      ['J · One forward test', () => { savedWithResults(); S().set({ forwardTests: FWD.slice(0, 1) }); }],
      ['K · Forward tests and live', () => { savedWithResults(); S().set({ forwardTests: FWD, liveTrades: LIVE }); S().edit('changed RSI (14) > 50 → 60 in Entry'); }],
    ],
  },
  {
    title: 'Bottom bar',
    items: [
      ['1 · Default, counts current', () => withStrategy()],
      ['3 · Edited, chart paused', () => { withStrategy(); W().strategyEdited(2); }],
      ['4 · Edit not finished', () => { withStrategy(halfBuiltStrategy()); W().strategyEdited(1); }],
      ['7 · Couldn\'t update (press Update chart)', () => { withStrategy(); W().strategyEdited(1); W().set({ failNextUpdate: true }); }],
      ['8 · No signals', () => { withStrategy(); S().set({ noSignals: true }); }],
      ['9 · Signal log open', () => { withStrategy(); W().setBottomTab('signals'); }],
    ],
  },
  {
    title: 'Setup block (Backtest tab)',
    items: [
      ['1 · First time, blank', () => { withStrategy(); S().set({ mode: 'backtest' }); }],
      ['3 · Saved setups, all current', () => { savedWithResults(); S().set({ mode: 'backtest' }); }],
      ['4 · Edited this setup', () => {
        savedWithResults(); S().set({ mode: 'backtest' });
        const ic = B().setups[0];
        B().edit(ic.id, { legs: ic.legs.map((l, i) => (i === 2 ? { ...l, strike: 'OTM6' } : l)) });
        B().toggleExpanded(ic.id);
      }],
      ['5 · Strategy changed on Build', () => { savedWithResults(); S().set({ mode: 'backtest' }); S().edit('added Volume > SMA (20) to Entry'); }],
      ['8 · A setup fails (press Update)', () => { savedWithResults(); S().set({ mode: 'backtest' }); S().edit('removed RSI (14) > 50 from Entry'); B().set({ failSetupName: 'Short Straddle' }); }],
      ['9 · Saved setup changed elsewhere', () => {
        savedWithResults(); S().set({ mode: 'backtest' });
        B().set({ setups: B().setups.map((s, i) => (i === 0 ? { ...s, newerSavedVersion: true } : s)) });
      }],
    ],
  },
];

export function ScenarioPanel() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  return (
    <div className="fixed top-3.5 right-[92px] z-40 flex flex-col items-end gap-2">
      <button
        type="button"
        title="Scenarios · prototype only"
        aria-label="Scenarios (prototype only)"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 items-center gap-1 rounded-pill border border-dashed px-2 text-label font-medium ${open || current ? 'border-brand text-brand' : 'border-border-radio text-text-tertiary'} hover:bg-surface-hover`}
      >
        ◐{current ? ` ${current.split(' · ')[0]}` : ''}
      </button>
      {open && (
        <div className="max-h-[70vh] w-[290px] overflow-auto rounded-card border border-border-control bg-surface p-2 shadow-dialog">
          <p className="m-0 px-2 pt-1 pb-2 text-hint text-text-tertiary">
            Prototype only · jump to a state from the component sheets
          </p>
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-1">
              <span className="block px-2 pt-2 pb-1 text-[11px] font-semibold text-text-tertiary uppercase">{g.title}</span>
              {g.items.map(([label, run]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    run();
                    setCurrent(label);
                  }}
                  className={`block w-full rounded-chip px-2 py-1.5 text-left text-label ${current === label ? 'bg-brand-tint font-semibold text-brand-text' : 'hover:bg-surface-hover'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
