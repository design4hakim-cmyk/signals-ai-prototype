import { Button, IconButton } from '@/components/ui/Button';
import { FolderIcon, PlayIcon, SettingsIcon } from '@/components/ui/icons';
import { useWorkspace } from '@/store/workspace';

/** Row 1: strategy name, Save, Period, Run Backtest (56px tall) */
export function TopBar() {
  const { strategyName, period } = useWorkspace();
  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border-divider pr-5 pl-3.5">
      <IconButton aria-label="My Strategies">
        <FolderIcon />
      </IconButton>
      <h1 className="m-0 min-w-0 truncate text-title font-semibold">{strategyName}</h1>
      <Button className="!h-[30px] !text-brand">Save</Button>
      <div className="grow" />
      <Button>
        Period <b className="font-semibold">{period}</b>
      </Button>
      {/* Disabled until the strategy has at least one condition */}
      <Button variant="primary" disabled title="Add an entry condition first">
        Run Backtest <PlayIcon />
      </Button>
    </header>
  );
}

/** Row 2: what you trade: instrument, chart data, timeframe (52px tall) */
export function ContextBar() {
  const { instrument, chartData, timeframe } = useWorkspace();
  return (
    <div className="flex h-contextbar shrink-0 items-center gap-2 border-b border-border-subtle px-5">
      <Button variant="dropdown">{instrument}</Button>
      <Button variant="dropdown">{chartData}</Button>
      <Button variant="dropdown">{timeframe}</Button>
      <IconButton aria-label="Chart settings" className="!size-control-sm border border-border-control">
        <SettingsIcon />
      </IconButton>
    </div>
  );
}
