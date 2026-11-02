import { useState } from 'react';
import { SAVED_LIBRARY, useBacktest } from '@/store/backtest';
import { ALL_TRADES, monteCarlo, MONTE_CARLO } from '@/lib/backtestData';
import { useResultsView } from '@/store/results';
import { useStrategy } from '@/store/strategy';
import { useWorkspace } from '@/store/workspace';

/*
  PROTOTYPE ONLY — a review helper, not part of the product.
  The canvas builder isn't coded yet, so this jumps the app into the
  states from the component sheets (Top nav A–K, Bottom bar 1–12, Setup block 1–9).
*/

const resetAll = () => {
  useStrategy.setState(useStrategy.getInitialState(), true);
  useWorkspace.setState(useWorkspace.getInitialState(), true);
  useBacktest.setState(useBacktest.getInitialState(), true);
  useResultsView.getState().reset();
};
const S = () => useStrategy.getState();
const W = () => useWorkspace.getState();
const B = () => useBacktest.getState();

/** A saved strategy with an entry, whose 3 setups are backtested and current. */
const savedWithResults = () => {
  resetAll();
  S().set({ entry: 'complete', name: 'NIFTY Momentum Breakout', saved: true });
  B().addSaved(SAVED_LIBRARY.slice(0, 3).map((s) => s.id));
  B().seedResults();
};

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
      ['B · Building, half-done', () => { resetAll(); S().set({ entry: 'partial' }); }],
      ['C · Ready, not saved', () => { resetAll(); S().set({ entry: 'complete' }); }],
      ['E · Saved', () => { resetAll(); S().set({ entry: 'complete', name: 'NIFTY Momentum Breakout', saved: true }); }],
      ['F · Saved, then edited', () => { resetAll(); S().set({ entry: 'complete', name: 'NIFTY Momentum Breakout', saved: true }); S().edit('changed RSI (14) > 50 → 60 in Entry'); }],
      ['H · Backtest results current', savedWithResults],
      ['I · Edited after backtest', () => { savedWithResults(); S().edit('added Volume > SMA (20) to Entry'); }],
      ['J · One forward test', () => { savedWithResults(); S().set({ forwardTests: FWD.slice(0, 1) }); }],
      ['K · Forward tests and live', () => { savedWithResults(); S().set({ forwardTests: FWD, liveTrades: LIVE }); S().edit('changed RSI (14) > 50 → 60 in Entry'); }],
    ],
  },
  {
    title: 'Bottom bar',
    items: [
      ['1 · Default, counts current', () => { resetAll(); S().set({ entry: 'complete' }); }],
      ['3 · Edited, chart paused', () => { resetAll(); S().set({ entry: 'complete' }); W().strategyEdited(2); }],
      ['4 · Edit not finished', () => { resetAll(); S().set({ entry: 'partial' }); W().strategyEdited(1); }],
      ['7 · Couldn\'t update (press Update chart)', () => { resetAll(); S().set({ entry: 'complete' }); W().strategyEdited(1); W().set({ failNextUpdate: true }); }],
      ['8 · No signals', () => { resetAll(); S().set({ entry: 'complete', noSignals: true }); }],
      ['9 · Signal log open', () => { resetAll(); S().set({ entry: 'complete' }); W().setBottomTab('signals'); }],
    ],
  },
  {
    title: 'Setup block (Backtest tab)',
    items: [
      ['1 · First time, blank', () => { resetAll(); S().set({ entry: 'complete', mode: 'backtest' }); }],
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
