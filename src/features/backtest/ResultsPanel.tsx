import { rupees } from '@/lib/backtestData';
import { useBacktest, type Setup } from '@/store/backtest';
import { useWorkspace } from '@/store/workspace';
import { NoTrades, ResultsPage, RunningResults } from './results/ResultsPage';

/*
  Layer 5 · Results — the answer.
  Empty · running (skeleton) · current = the full results page (design/backtest-results) ·
  faded + banner when outdated · failed: partial results + banner, or the reason when there's nothing.
*/

type MetricKey = 'netPnl' | 'maxDrawdown' | 'winRate' | 'trades';
// drawdown is negative ₹, so a higher (shallower) number is better too
const METRICS: { key: MetricKey; label: string; fmt: (n: number) => string; higherIsBetter: boolean }[] = [
  { key: 'netPnl', label: 'NET P&L', fmt: (n) => rupees(n), higherIsBetter: true },
  { key: 'maxDrawdown', label: 'MAX DRAWDOWN', fmt: (n) => rupees(n), higherIsBetter: true },
  { key: 'winRate', label: 'WIN RATE', fmt: (n) => `${n}%`, higherIsBetter: true },
  { key: 'trades', label: 'TRADES', fmt: (n) => String(n), higherIsBetter: true },
];

export function ResultsPanel({ setup }: { setup: Setup }) {
  const { edit, toggleExpanded } = useBacktest();
  const setPeriod = useWorkspace((s) => s.setPeriod);
  const runBacktests = useBacktest((s) => s.runBacktests);

  // failed with nothing to show: say why and offer the way out (partial results go to the page below)
  if (setup.status === 'failed' && setup.error && !setup.results)
    return (
      <div className="flex flex-col items-start gap-2 px-5 py-6">
        <span className="text-body-lg font-semibold">Couldn't backtest {setup.name}</span>
        <span className="text-body text-text-secondary">{setup.error.reason}</span>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPeriod('6M');
              edit(setup.id, {}); // marks it to run again
              setTimeout(runBacktests, 0);
            }}
            className="h-8 rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint"
          >
            Set Period to 6M
          </button>
          <button type="button" onClick={() => !setup.expanded && toggleExpanded(setup.id)} className="h-8 rounded-control border border-border-chip bg-surface px-3 text-body hover:bg-surface-hover">
            Edit setup
          </button>
        </div>
      </div>
    );

  const loading = setup.status === 'running' || setup.status === 'queued';
  if (!setup.results && !loading)
    return (
      <div className="flex flex-col items-center gap-1 px-5 py-8 text-center">
        <span className="text-body font-medium text-text-secondary">No backtest yet</span>
        <span className="text-chip text-text-muted">
          Fill the setup, then hit <b className="font-semibold text-text-primary">Run backtest</b> at the top right.
        </span>
      </div>
    );

  if (loading) return <RunningResults />;
  if (setup.results?.noTrades) return <NoTrades />;
  return <ResultsPage setup={setup} />;
}

/** Compare tab: every setup side by side. */
export function CompareTable() {
  const { setups, select } = useBacktest();
  if (!setups.length)
    return (
      <div className="px-5 py-8 text-center text-chip text-text-muted">
        Add a trade setup to backtest this strategy.
      </div>
    );
  return (
    <table className="w-full border-collapse text-body">
      <thead>
        <tr className="text-left text-[11px] text-text-tertiary">
          <th className="px-5 py-2.5 font-semibold">SETUP</th>
          {METRICS.map((m) => (
            <th key={m.key} className="px-5 py-2.5 font-semibold">{m.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {setups.map((s) => (
          <tr key={s.id} onClick={() => select(s.id)} className={`cursor-pointer border-t border-border-subtle hover:bg-surface-hover ${s.status === 'outdated' ? 'opacity-50' : ''}`}>
            <td className="px-5 py-3 font-medium">{s.name}</td>
            {METRICS.map((m) => (
              <td key={m.key} className="px-5 py-3 tabular-nums">{s.results ? m.fmt(s.results[m.key]) : '—'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
