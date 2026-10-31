import { useBacktest, type Results, type Setup } from '@/store/backtest';
import { useWorkspace } from '@/store/workspace';

/*
  Layer 5 · Results — the answer.
  Empty · loading (skeleton) · current · faded when outdated · change pills after an update · failed.
*/

const METRICS: { key: keyof Results; label: string; fmt: (n: number) => string; higherIsBetter: boolean }[] = [
  { key: 'netPnl', label: 'NET P&L', fmt: (n) => `₹${n.toLocaleString('en-IN')}`, higherIsBetter: true },
  { key: 'maxDrawdown', label: 'MAX DRAWDOWN', fmt: (n) => `₹${n.toLocaleString('en-IN')}`, higherIsBetter: false },
  { key: 'winRate', label: 'WIN RATE', fmt: (n) => `${n}%`, higherIsBetter: true },
  { key: 'trades', label: 'TRADES', fmt: (n) => String(n), higherIsBetter: true },
];

export function ResultsPanel({ setup }: { setup: Setup }) {
  const { edit, toggleExpanded } = useBacktest();
  const setPeriod = useWorkspace((s) => s.setPeriod);
  const runBacktests = useBacktest((s) => s.runBacktests);

  if (setup.status === 'failed' && setup.error)
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

  const faded = setup.status === 'outdated';
  return (
    <div className={`grid grid-cols-4 gap-px bg-border-subtle transition-opacity ${faded ? 'opacity-45' : ''}`}>
      {METRICS.map((m) => {
        const now = setup.results?.[m.key];
        const before = setup.previous?.[m.key];
        return (
          <div key={m.key} className="flex flex-col gap-1 bg-surface px-5 py-4">
            <span className="text-[11px] font-semibold text-text-tertiary">{m.label}</span>
            {loading || now === undefined ? (
              <span className="mt-1 h-6 w-28 animate-pulse rounded-chip bg-surface-selected" />
            ) : (
              <span className="flex items-baseline gap-2">
                <span className="text-[20px] font-semibold tabular-nums">{m.fmt(now)}</span>
                {before !== undefined && setup.status === 'current' && <ChangePill now={now} before={before} good={m.higherIsBetter} />}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChangePill({ now, before, good }: { now: number; before: number; good: boolean }) {
  if (now === before) return <span className="text-hint text-text-subtle">No change</span>;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const up = pct > 0;
  const better = up === good;
  return (
    <span className={`rounded-[4px] px-1.5 text-hint font-semibold ${better ? 'bg-buy-tint text-pnl-up' : 'bg-sell-tint text-pnl-down'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
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
