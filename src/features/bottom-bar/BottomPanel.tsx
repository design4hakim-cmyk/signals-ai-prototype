import { CollapseIcon, ExpandIcon } from '@/components/ui/icons';
import { longLabel } from '@/lib/describeChartData';
import { PriceChart } from '@/features/chart/PriceChart';
import { useUnfinished } from '@/store/canvas';
import { useStrategy } from '@/store/strategy';
import { useWorkspace } from '@/store/workspace';
import { LimitsGroup } from './LimitPanel';
import { SignalLog } from './SignalLog';
import { useAppliedChart } from './useSignals';

/*
  Bottom bar · one component (K11, K12).
  Chart and Signals are two tabs of one panel. The Signals tab carries the
  entry/exit counts; opening it shows the log. Green = entries, red = exits,
  used only on numbers and markers.

  What pauses the chart: any strategy edit, or a change to instrument, chart data,
  timeframe or period. One way to refresh: the outlined "Update chart" button.
  Limits don't pause it — they filter signals already calculated.
*/

export function BottomPanel() {
  const { candles, signals, applied } = useAppliedChart();
  const { bottomTab, panelOpen, pendingChanges, chartStatus, togglePanel } = useWorkspace();
  const entry = useStrategy((s) => s.entry);
  const unfinished = useUnfinished();
  const paused = pendingChanges > 0 || chartStatus === 'error' || (!!unfinished && chartStatus !== 'updating');
  const caption = `${longLabel(applied.chartData, applied.instrument)} · ${applied.timeframe} · ${applied.period}`;

  return (
    <section aria-label="Chart and signals" className="flex shrink-0 flex-col border-t border-border-divider bg-surface">
      {panelOpen && (
        <div className="relative h-bottompanel px-4 pt-3">
          <div className={`flex h-full flex-col transition-opacity ${paused || chartStatus === 'updating' ? 'opacity-45' : ''}`}>
            {bottomTab === 'chart' ? (
              <>
                <span className="mb-1.5 text-label text-text-tertiary">{caption}</span>
                <div className="min-h-0 grow overflow-hidden rounded-control border border-border-subtle">
                  <PriceChart candles={candles} trades={signals?.trades} />
                </div>
              </>
            ) : (
              <SignalLog />
            )}
          </div>
          {paused && chartStatus !== 'updating' && (
            <span className="absolute top-12 left-1/2 -translate-x-1/2 rounded-control border border-border-control bg-surface px-3 py-1.5 text-label font-medium text-text-secondary shadow-segment">
              Showing your last update{pendingChanges > 0 && ` · ${pendingChanges} change${pendingChanges > 1 ? 's' : ''} since`}
            </span>
          )}
        </div>
      )}

      <div role="toolbar" aria-label="Chart and signals" className="flex h-bottombar shrink-0 items-center gap-3 px-3.5">
        <Tabs />
        <UpdateChart />
        <span className="flex-1" />
        {signals && signals.skipped > 0 && !paused && (
          <span className="flex items-center gap-1.5 text-label text-text-subtle" title="Entries held back by your limits">
            <svg width="9" height="8" viewBox="0 0 10 9" aria-hidden="true">
              <path d="M5 1.2L9.1 8.4H.9z" fill="none" stroke="var(--color-buy-text)" strokeWidth="1.2" />
            </svg>
            {signals.skipped} skipped
          </span>
        )}
        {entry === 'complete' && <LimitsGroup />}
        <button
          type="button"
          aria-label={panelOpen ? 'Collapse chart' : 'Expand chart'}
          onClick={togglePanel}
          className="flex size-[30px] items-center justify-center rounded-segment-item border border-border-control bg-surface text-text-secondary hover:bg-surface-hover"
        >
          {panelOpen ? <CollapseIcon size={15} /> : <ExpandIcon size={15} />}
        </button>
      </div>
    </section>
  );
}

/** Chart tab + Signals tab (carries the counts). */
function Tabs() {
  const { signals, hasStrategy, noSignals, applied } = useAppliedChart();
  const { bottomTab, setBottomTab, panelOpen, pendingChanges, chartStatus, previousCounts } = useWorkspace();
  const paused = pendingChanges > 0;
  const updating = chartStatus === 'updating';
  const tabCls = (on: boolean) =>
    `flex h-8 items-center gap-2 whitespace-nowrap rounded-segment-item px-3 text-body font-medium text-text-primary ${
      on ? 'bg-surface shadow-segment' : 'hover:bg-surface/60'
    }`;
  const delta = (now: number, before?: number) =>
    chartStatus === 'updated' && before !== undefined && now !== before ? (
      <span className="rounded-[4px] bg-surface-selected px-1 text-[11px] font-semibold text-text-secondary">
        {now > before ? '+' : '−'}
        {Math.abs(now - before)}
      </span>
    ) : null;

  return (
    <div role="tablist" className="flex rounded-segment bg-surface-selected p-[3px]">
      <button type="button" role="tab" aria-selected={panelOpen && bottomTab === 'chart'} onClick={() => setBottomTab('chart')} className={tabCls(panelOpen && bottomTab === 'chart')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 17l5-6 4 3 6-8 3 3" />
        </svg>
        Chart
      </button>
      <button type="button" role="tab" aria-selected={panelOpen && bottomTab === 'signals'} aria-label="Signal log" onClick={() => setBottomTab('signals')} className={tabCls(panelOpen && bottomTab === 'signals')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        {!hasStrategy ? (
          <span className="font-normal text-text-subtle">Signals · no conditions yet</span>
        ) : noSignals ? (
          <span className="font-normal text-text-tertiary">No entries in {applied.period} · try loosening a condition</span>
        ) : (
          <span className={`flex items-center gap-1.5 ${paused ? 'opacity-40 grayscale' : ''}`}>
            <svg width="9" height="8" viewBox="0 0 10 9" aria-hidden="true"><path d="M5 0L10 9H0z" fill="var(--color-buy-text)" /></svg>
            <b className="font-semibold text-buy-text">{updating ? '—' : signals?.entries}</b>
            <span className="text-buy-text">Entry</span>
            {delta(signals?.entries ?? 0, previousCounts?.entries)}
            <span className="text-border-radio">·</span>
            <svg width="9" height="8" viewBox="0 0 10 9" aria-hidden="true"><path d="M0 0h10L5 9z" fill="var(--color-sell-text)" /></svg>
            <b className="font-semibold text-sell-text">{updating ? '—' : signals?.exits}</b>
            <span className="text-sell-text">Exit</span>
            {delta(signals?.exits ?? 0, previousCounts?.exits)}
            <span className="font-normal text-text-subtle">in {applied.period}</span>
          </span>
        )}
      </button>
    </div>
  );
}

/** The one way to refresh. Outlined, with how many changes are waiting. */
function UpdateChart() {
  const { signals } = useAppliedChart();
  const { pendingChanges, chartStatus, updateChart } = useWorkspace();
  const unfinished = useUnfinished();
  const counts = { entries: signals?.entries ?? 0, exits: signals?.exits ?? 0 };

  if (chartStatus === 'updating')
    return (
      <span className="flex h-8 items-center gap-2 rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand">
        <span className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        Updating chart…
      </span>
    );
  if (chartStatus === 'error')
    return (
      <span className="flex items-center gap-2 text-body text-sell-text">
        Couldn't update the chart
        <button type="button" onClick={() => updateChart(counts)} className="h-8 rounded-control border border-brand bg-surface px-3 font-medium text-brand hover:bg-brand-tint">
          Retry
        </button>
      </span>
    );
  // A half-built condition blocks the update (U02)
  if (unfinished)
    return (
      <span className="flex items-center gap-2.5">
        <button type="button" disabled className="h-[34px] cursor-not-allowed rounded-control bg-surface-disabled px-3.5 text-body font-medium text-text-disabled">
          Update chart
        </button>
        <span className="text-label text-text-tertiary">
          Finish {unfinished.side === 'exit' ? 'exit ' : ''}condition {unfinished.number} first
        </span>
      </span>
    );
  if (pendingChanges === 0) return null;
  return (
    <button
      type="button"
      onClick={() => updateChart(counts)}
      className="flex h-8 items-center gap-2 rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint"
    >
      Update chart
      <span className="rounded-[4px] bg-brand-tint px-1.5 text-[11px] font-semibold">
        {pendingChanges} change{pendingChanges > 1 ? 's' : ''}
      </span>
    </button>
  );
}
