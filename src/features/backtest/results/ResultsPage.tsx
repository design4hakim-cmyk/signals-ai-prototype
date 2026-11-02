import { useEffect, useMemo, useState } from 'react';
import { ALL_TRADES, inOutSample, isoToLabel, resultsView, SETUP, variantFor } from '@/lib/backtestData';
import { useBacktest, type Setup } from '@/store/backtest';
import { useResultsView } from '@/store/results';
import { useStrategy } from '@/store/strategy';
import { useWorkspace } from '@/store/workspace';
import { Bone, Card, OutlinedBlueButton, SecondaryButton } from './bits';
import { DetailedStats, YearHeatmap } from './Breakdown';
import { EquityChart } from './EquityChart';
import { downloadReport, downloadTrades } from './helpers';
import { Robustness } from './Robustness';
import { Headline, HeadlineSkeleton, ResultsHeader } from './Summary';
import { TradesTable } from './TradesTable';

/*
  The full results page (design/backtest-results), top to bottom, gap 14:
  header · headline numbers · equity curve · year-wise returns · detailed statistics · robustness · trades.
  Page states keep ResultsPanel's logic: running → skeleton, outdated → faded + banner,
  failed with partial results → red banner + what's there, no trades → dashed card.
*/

export function ResultsPage({ setup }: { setup: Setup }) {
  const vix = useResultsView((s) => s.vix);
  const split = useResultsView((s) => s.split);
  const period = useWorkspace((s) => s.applied.period);
  const runBacktests = useBacktest((s) => s.runBacktests);
  const partialUntil = setup.status === 'failed' ? setup.error?.partialUntil ?? null : null;
  const view = useMemo(() => resultsView({ vix, until: partialUntil, variant: variantFor(setup.name) }), [vix, partialUntil, setup.name]);
  const allTrades = useMemo(() => resultsView({ until: partialUntil, variant: variantFor(setup.name) }).trades, [partialUntil, setup.name]);
  const splitDate = useMemo(() => inOutSample(view.trades, split).splitDate, [view.trades, split]);
  const outdated = setup.status === 'outdated';

  return (
    <div className="flex flex-col gap-3.5 border-t border-border-divider px-5 pt-4 pb-6">
      {outdated && (
        <Banner tone="info" action={<OutlinedBlueButton onClick={runBacktests}>Update backtest</OutlinedBlueButton>}>
          <b className="font-semibold">Strategy changed</b> · these results are from the previous version
        </Banner>
      )}
      {setup.status === 'failed' && setup.error && (
        <Banner tone="error" action={<SecondaryButton onClick={runBacktests}>Try again</SecondaryButton>}>
          <b className="font-semibold">Backtest couldn’t finish</b> · {setup.error.reason}
        </Banner>
      )}
      <div className={`flex flex-col gap-3.5 transition-opacity ${outdated ? 'opacity-45' : ''}`}>
        <ResultsHeader view={view} allTrades={allTrades} instrument={SETUP.instrument} periodLabel={period} onDownload={() => downloadReport(setup.name, view)} />
        {/* change pills right after an update, unfiltered only (a filter isn't a new run) */}
        <Headline view={view} previous={setup.status === 'current' && !vix ? setup.previous : null} />
        <EquityChart equity={view.equity} stats={view.stats} splitDate={splitDate} />
        <YearHeatmap view={view} />
        <DetailedStats view={view} />
        <Robustness view={view} />
        <TradesTable trades={view.trades} onDownload={() => downloadTrades(setup.name, view.trades)} />
      </div>
    </div>
  );
}

function Banner({ tone, action, children }: { tone: 'info' | 'error'; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-3 rounded-control border px-3.5 py-2.5 text-body ${tone === 'error' ? 'border-error/30 bg-error-bg text-error' : 'border-border-control bg-surface text-text-secondary'}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${tone === 'error' ? 'bg-error' : 'bg-brand'}`} aria-hidden="true" />
      <span className="grow">{children}</span>
      {action}
    </div>
  );
}

/** Running: skeletons keep the layout; one progress line, no spinner. */
export function RunningResults() {
  const total = ALL_TRADES.length;
  const [days, setDays] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      // eases toward the end; the run finishing replaces this view
      setDays(Math.min(total - 1, Math.round(total * (1 - Math.exp(-(performance.now() - start) / 1400)))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <div className="flex flex-col gap-3.5 border-t border-border-divider px-5 pt-4 pb-6" aria-busy="true">
      <div className="flex flex-col gap-1.5">
        <Bone className="h-4 w-24" />
        <Bone className="h-3 w-72" />
      </div>
      <HeadlineSkeleton />
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <Bone className="h-3 w-28" />
          <Bone className="h-[260px] w-full" />
          <div className="flex items-center gap-3">
            <div className="h-1 grow overflow-hidden rounded-full bg-surface-selected">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(days / total) * 100}%` }} />
            </div>
            <span className="text-label text-text-tertiary tabular-nums" role="status">
              Running backtest · {days} of {total} days
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** No trades: a dashed card that says why and offers the two ways out. */
export function NoTrades() {
  const setMode = useStrategy((s) => s.setMode);
  return (
    <div className="border-t border-border-divider px-5 pt-4 pb-6">
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong px-6 py-10 text-center">
        <span className="text-body-lg font-semibold">No trades in this period</span>
        <span className="max-w-[440px] text-body text-text-secondary">
          Your entry conditions never matched between {isoToLabel(SETUP.period.from)} and {isoToLabel(SETUP.period.to)}. Try a longer period, or loosen a condition on Build.
        </span>
        <div className="mt-2 flex gap-2">
          {/* the top nav's Period menu opens itself */}
          <SecondaryButton onClick={() => window.dispatchEvent(new Event('open-period-menu'))}>Change period</SecondaryButton>
          <button type="button" onClick={() => setMode('build')} className="h-[30px] rounded-control px-3 text-body font-medium text-brand hover:bg-brand-tint">
            Go to Build
          </button>
        </div>
      </div>
    </div>
  );
}
