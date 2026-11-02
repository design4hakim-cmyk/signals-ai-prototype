import { useEffect, useState } from 'react';
import { ChevronDownIcon, FolderIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { resultsCurrent, useBacktest } from '@/store/backtest';
import { useStrategy } from '@/store/strategy';
import { useWorkspace } from '@/store/workspace';
import type { Period } from '@/types/market';
import { MoreMenu } from './MoreMenu';
import { NameField } from './NameField';
import { RunningTrades } from './RunningTrades';
import { TradeDialogs } from './TradeDialogs';

/*
  Top nav bar (TopNav-Components sheet).
  Three fixed zones — the middle stays centred whatever the name length:
    LEFT   the strategy: folder · name · Draft · Save/Update · ⋯
    MIDDLE the mode: Build / Backtest (navigation, never filled blue)
    RIGHT  trades and the next step: Period · running trades · Trade
  Only ONE filled-blue button on screen at a time.
*/

export function TopNav() {
  const st = useStrategy();
  const setups = useBacktest((s) => s.setups);
  const running = useBacktest((s) => s.run !== null);
  const current = resultsCurrent(setups);
  const trading = st.forwardTests.length + st.liveTrades.length > 0;
  const [dialog, setDialog] = useState<'unsaved' | 'live' | null>(null);

  const showDraft = st.saved && !trading;
  const canSave = st.entry !== 'empty' && (!st.saved || st.dirty);

  const onUpdate = () => (st.liveTrades.length ? setDialog('live') : st.save());
  const onTrade = () => {
    if (st.dirty || (!st.saved && st.entry !== 'empty')) return setDialog('unsaved');
    st.showToast('The Trade popup (Forward test / Live) comes in the Trade phase');
  };

  return (
    <header className="grid h-topbar shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-4 border-b border-border-divider pr-5 pl-4">
      {/* LEFT · the strategy */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="Saved strategies"
          title="Saved strategies"
          className="flex size-8 shrink-0 items-center justify-center rounded-segment-item text-text-primary hover:bg-surface-selected"
        >
          <FolderIcon />
        </button>

        <NameField />

        {showDraft && st.saveStatus !== 'naming' && (
          <span className="shrink-0 rounded-[5px] bg-chip-neutral px-2 py-0.5 text-hint font-semibold text-text-secondary">Draft</span>
        )}

        {/* Save / Update slot: its presence IS the save status */}
        {st.saveStatus === 'saving' && <span className="shrink-0 text-body text-text-muted">Saving…</span>}
        {st.saveStatus === 'error' && (
          <span className="flex shrink-0 items-center gap-2 text-body text-sell-text">
            Couldn't save · edits kept
            <button type="button" onClick={() => st.save()} className="font-medium text-brand hover:underline">
              Retry
            </button>
          </span>
        )}
        {st.saveStatus === 'idle' && canSave && (
          <button
            type="button"
            onClick={() => (st.saved ? onUpdate() : st.startNaming())}
            className="h-[30px] shrink-0 rounded-segment-item border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {st.saved ? 'Update' : 'Save'}
          </button>
        )}

        {st.saved && st.saveStatus !== 'naming' && <MoreMenu trading={trading} />}
      </div>

      {/* MIDDLE · the mode */}
      <ModeSwitch dot={st.entry === 'complete' && !current} locked={st.entry !== 'complete'} />

      {/* RIGHT · trades and the next step */}
      <div className="flex items-center justify-end gap-2.5">
        <PeriodMenu locked={running} />
        <RunningTrades />
        <button
          type="button"
          onClick={onTrade}
          disabled={st.entry !== 'complete'}
          title={st.entry !== 'complete' ? 'No complete entry yet' : current ? undefined : 'Backtest results are outdated'}
          className={`h-[34px] shrink-0 rounded-control border px-4 text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:border-border-control disabled:bg-surface disabled:text-text-disabled ${
            current
              ? 'border-brand bg-brand text-text-on-brand hover:bg-brand-hover'
              : 'border-brand bg-surface text-brand hover:bg-brand-tint'
          }`}
        >
          Trade
        </button>
      </div>

      <TradeDialogs open={dialog} onClose={() => setDialog(null)} />
    </header>
  );
}

/** Build / Backtest. Larger segmented control, centred, never moves. Blue dot = Backtest has something to run. */
function ModeSwitch({ dot, locked }: { dot: boolean; locked: boolean }) {
  const mode = useStrategy((s) => s.mode);
  const setMode = useStrategy((s) => s.setMode);
  return (
    <div role="tablist" aria-label="Mode" className="flex rounded-[10px] bg-surface-selected p-[3px]">
      {(['build', 'backtest'] as const).map((m) => {
        const on = mode === m;
        const disabled = m === 'backtest' && locked;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={disabled}
            title={disabled ? 'No complete entry yet' : undefined}
            onClick={() => setMode(m)}
            className={`flex h-8 w-28 items-center justify-center gap-[7px] rounded-control text-body-lg font-medium disabled:cursor-not-allowed disabled:text-text-disabled ${
              on ? 'bg-surface text-text-primary shadow-segment' : 'text-text-secondary enabled:hover:text-text-primary'
            }`}
          >
            {m === 'backtest' && dot && !on && <span className="size-[7px] rounded-full bg-brand" />}
            {m === 'build' ? 'Build' : 'Backtest'}
          </button>
        );
      })}
    </div>
  );
}

const PERIODS: Period[] = ['1M', '3M', '6M', '1Y', '3Y'];

/** Quiet text button. Locks while a backtest runs. The "Period" label drops in narrow windows. */
function PeriodMenu({ locked }: { locked: boolean }) {
  const period = useWorkspace((s) => s.period);
  const setPeriod = useWorkspace((s) => s.setPeriod);
  const [open, setOpen] = useState(false);
  // "Change period" on an empty backtest result opens this menu
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('open-period-menu', show);
    return () => window.removeEventListener('open-period-menu', show);
  }, []);
  return (
    <Popover
      open={open}
      align="right"
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          disabled={locked}
          title={locked ? 'Locked while the backtest runs' : undefined}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          className={`flex h-8 items-center gap-1 rounded-segment-item px-2 text-[12.5px] text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50 ${
            open ? 'bg-surface-selected' : 'enabled:hover:bg-surface-selected'
          }`}
        >
          <span className="max-[1380px]:hidden">Period</span>
          <b className="font-semibold text-text-primary">{period}</b>
          <ChevronDownIcon size={12} />
        </button>
      }
    >
      <div role="listbox" aria-label="Period" className="flex w-40 flex-col rounded-block border border-border-control bg-surface p-1.5 shadow-popover">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="option"
            aria-selected={p === period}
            onClick={() => {
              setPeriod(p);
              setOpen(false);
            }}
            className={`flex h-8 items-center justify-between rounded-chip px-2.5 text-body ${
              p === period ? 'bg-brand-tint font-semibold text-brand-text' : 'hover:bg-surface-hover'
            }`}
          >
            {{ '1M': '1 month', '3M': '3 months', '6M': '6 months', '1Y': '1 year', '3Y': '3 years' }[p]}
            {p === period && <span>✓</span>}
          </button>
        ))}
      </div>
    </Popover>
  );
}
