import { useMemo } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { CollapseIcon, ExpandIcon } from '@/components/ui/icons';
import { PriceChart } from '@/features/chart/PriceChart';
import { longLabel } from '@/lib/describeChartData';
import { generateSeries } from '@/mock/candles';
import { useWorkspace } from '@/store/workspace';

/** Bottom panel: Chart / Logs tabs + the price chart. Collapsible (board ST-S02). */
export function BottomPanel() {
  const { instrument, chartData, timeframe, period, bottomTab, setBottomTab, chartCollapsed, toggleChart } =
    useWorkspace();
  // useMemo = only regenerate candles when what we plot changes
  const candles = useMemo(
    () => generateSeries(instrument, timeframe, chartData),
    [instrument, timeframe, chartData],
  );

  return (
    <section
      aria-label="Chart and logs"
      className={`flex shrink-0 flex-col border-t border-border-divider bg-surface transition-[height] duration-200 ${
        chartCollapsed ? 'h-12' : 'h-bottompanel'
      }`}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <Button variant="tab" selected={bottomTab === 'chart'} onClick={() => setBottomTab('chart')}>
          Chart
        </Button>
        <Button variant="tab" selected={bottomTab === 'logs'} onClick={() => setBottomTab('logs')}>
          Logs
        </Button>
        <span className="ml-1.5 text-label text-text-tertiary">
          {longLabel(chartData, instrument)} · {timeframe} · {period}
        </span>
        <div className="grow" />
        <IconButton aria-label={chartCollapsed ? 'Expand chart' : 'Collapse chart'} onClick={toggleChart}>
          {chartCollapsed ? <ExpandIcon /> : <CollapseIcon />}
        </IconButton>
      </div>

      {!chartCollapsed && (
        <div className="mx-4 mb-3 min-h-0 grow overflow-hidden rounded-control border border-border-subtle">
          {bottomTab === 'chart' ? (
            <PriceChart candles={candles} />
          ) : (
            <div className="flex h-full items-center justify-center text-chip text-text-muted">
              No signals yet. Add an entry condition to see them here.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
