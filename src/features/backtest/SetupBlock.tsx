import { useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import { isComplete, useBacktest, type Setup } from '@/store/backtest';
import { useStrategy } from '@/store/strategy';
import { AddSetupPopover, ConfirmRemove, SetupMenu } from './SetupPopovers';
import { SetupForm } from './SetupForm';
import { CompareTable, ResultsPanel } from './ResultsPanel';

/*
  Setup block · one component (SetupBlock-Unified sheet).
  Five layers, always in this order — a state change only touches its own layer:
    1 Tab row   which setup, and run      (the Run button is the only thing that runs)
    2 Status    why                        (only when something needs saying; never buttons that run)
    3 Header    what it is                 (name, Save/Update setup, chips, ⋯, Expand/Collapse)
    4 Body      the inputs                 (expanded form; collapsed = the chips are the summary)
    5 Results   the answer
*/

export function SetupBlock() {
  const { setups, activeId } = useBacktest();
  const active = setups.find((s) => s.id === activeId) ?? null;

  return (
    <div className="overflow-visible rounded-card border border-border-divider bg-surface">
      <TabRow />
      <StatusStrip active={active} />
      {activeId === 'compare' || !active ? (
        <CompareTable />
      ) : (
        <>
          <Header setup={active} />
          {active.expanded && <SetupForm setup={active} />}
          <ResultsPanel setup={active} />
        </>
      )}
    </div>
  );
}

/* ── Layer 1 · Tab row ─────────────────────────────────────────── */

function TabRow() {
  const { setups, activeId, select } = useBacktest();
  const [adding, setAdding] = useState(false);

  return (
    <nav aria-label="Trade setups" className="flex h-[46px] items-center gap-0.5 border-b border-border-divider pr-3 pl-5">
      {setups.length > 1 && (
        <>
          <Tab label="Compare" on={activeId === 'compare'} onClick={() => select('compare')} />
          <span className="mx-1 h-5 w-px bg-border-control" />
        </>
      )}
      <div className="flex min-w-0 items-center overflow-x-auto">
        {setups.map((s) => (
          <SetupTab key={s.id} setup={s} />
        ))}
      </div>
      <Popover
        open={adding}
        onClose={() => setAdding(false)}
        trigger={
          <button type="button" onClick={() => setAdding((a) => !a)} className="h-[46px] shrink-0 px-3.5 text-[13.5px] whitespace-nowrap text-text-subtle hover:text-brand">
            + Add trade setup
          </button>
        }
      >
        <AddSetupPopover onDone={() => setAdding(false)} />
      </Popover>
      <span className="flex-1" />
      <RunButton />
    </nav>
  );
}

function Tab({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`relative flex h-[46px] shrink-0 items-center gap-1.5 px-3.5 text-[13.5px] whitespace-nowrap ${
        on ? 'font-medium text-brand' : 'text-text-tertiary hover:text-text-primary'
      }`}
    >
      {children}
      {label}
      {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
    </button>
  );
}

/** Tabs carry run status: dot = needs a run, spinner = running, ring = queued, red = failed. */
function SetupTab({ setup }: { setup: Setup }) {
  const { activeId, select } = useBacktest();
  const [confirm, setConfirm] = useState(false);
  const on = activeId === setup.id;
  const status =
    setup.status === 'running' ? (
      <span className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    ) : setup.status === 'queued' ? (
      <span className="size-1.5 rounded-full border border-text-subtle" />
    ) : setup.status === 'failed' ? (
      <span className="size-1.5 rounded-full bg-sell" />
    ) : setup.status === 'outdated' ? (
      <span className="size-1.5 rounded-full bg-warn-dot" />
    ) : null;

  return (
    <Popover
      open={confirm}
      onClose={() => setConfirm(false)}
      trigger={
        <div className="group flex items-center">
          <Tab label={setup.name} on={on} onClick={() => select(setup.id)}>
            {status}
          </Tab>
          <button
            type="button"
            aria-label={`Remove ${setup.name}`}
            onClick={() => setConfirm(true)}
            className="-ml-2.5 mr-1 hidden size-5 items-center justify-center rounded-chip text-text-subtle group-hover:flex hover:bg-surface-selected"
          >
            ×
          </button>
        </div>
      }
    >
      <ConfirmRemove setup={setup} onDone={() => setConfirm(false)} />
    </Popover>
  );
}

/** The only button that runs. Filled blue only when there's something to run. */
function RunButton() {
  const { setups, run, runBacktests, cancelRun, strategyChange } = useBacktest();
  const filled = 'h-8 rounded-control border border-brand bg-brand px-3.5 text-body font-medium text-text-on-brand hover:bg-brand-hover';

  if (run)
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-8 items-center gap-2 px-1 text-body font-medium text-forward-text">
          <span className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Updating {Math.min(run.done + 1, run.total)} of {run.total}
        </span>
        <button type="button" onClick={cancelRun} className="h-8 rounded-control border border-border-chip bg-surface px-3 text-body hover:bg-surface-hover">
          Cancel
        </button>
      </div>
    );

  const failed = setups.filter((s) => s.status === 'failed');
  const outdated = setups.filter((s) => s.status === 'outdated');
  const blank = setups.filter((s) => s.status === 'blank');
  const blankReady = blank.filter(isComplete);

  if (failed.length && !outdated.length)
    return <button type="button" onClick={runBacktests} className={filled}>Retry {failed.length} failed</button>;
  if (outdated.length)
    return (
      <button type="button" onClick={runBacktests} className={filled}>
        {outdated.length > 1 ? `Update ${outdated.length} backtests` : strategyChange || outdated[0].everRun ? 'Update backtest' : 'Run backtest'}
      </button>
    );
  if (blank.length)
    return (
      <button
        type="button"
        onClick={runBacktests}
        disabled={!blankReady.length}
        title={blankReady.length ? undefined : 'Select a strike for every leg first'}
        className={`${filled} disabled:cursor-not-allowed disabled:border-action-disabled disabled:bg-action-disabled`}
      >
        Run backtest
      </button>
    );
  if (!setups.length) return null;
  return (
    <span className="flex h-8 items-center gap-1.5 px-2 text-body text-text-tertiary">
      <span className="text-buy">✓</span> Up to date
    </span>
  );
}

/* ── Layer 2 · Status strip ────────────────────────────────────── */

function StatusStrip({ active }: { active: Setup | null }) {
  const { setups, run, strategyChange } = useBacktest();
  const setMode = useStrategy((s) => s.setMode);
  const failed = setups.filter((s) => s.status === 'failed');
  const outdated = setups.filter((s) => s.status === 'outdated');

  let tone: 'info' | 'warn' = 'info';
  let content: React.ReactNode = null;

  if (run) {
    const ready = setups.filter((s) => s.status === 'current' && run.queue.length < run.total);
    if (active && (active.status === 'running' || active.status === 'queued'))
      content = (
        <>
          <b className="font-semibold">Running {active.name}.</b> About {Math.max(2, run.queue.length * 2)} seconds left.
        </>
      );
    else
      content = (
        <>
          <b className="font-semibold">Updating {Math.min(run.done + 1, run.total)} of {run.total}.</b>{' '}
          {ready[0] ? `${ready[0].name} is ready; the rest finish in the background.` : 'Results land tab by tab.'}
        </>
      );
  } else if (failed.length) {
    tone = 'warn';
    const ok = setups.filter((s) => s.status === 'current').length;
    content = (
      <>
        <b className="font-semibold">{ok} of {ok + failed.length} updated.</b> {failed.map((f) => f.name).join(', ')} failed.
      </>
    );
  } else if (strategyChange && outdated.length) {
    tone = 'warn';
    content = (
      <>
        <b className="font-semibold">Strategy changed:</b> {strategyChange}.{' '}
        {outdated.length > 1 ? `All ${outdated.length} setups are outdated; old results are shown faded until you update.` : 'These results are outdated.'}{' '}
        <button type="button" onClick={() => setMode('build')} className="font-medium text-brand hover:underline">
          See on Build
        </button>
      </>
    );
  } else if (active?.status === 'outdated') {
    tone = 'warn';
    content = (
      <>
        <b className="font-semibold">You edited this setup.</b> Its results are outdated; the other setups are unaffected.
      </>
    );
  }

  if (!content) return null;
  return (
    <div role="status" className={`flex items-center gap-2.5 border-b border-border-subtle px-5 py-2 text-[12.5px] ${tone === 'warn' ? 'bg-warn-tint text-warn-text' : 'text-forward-text'}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${tone === 'warn' ? 'bg-warn-dot' : 'bg-brand'}`} />
      <span>{content}</span>
    </div>
  );
}

/* ── Layer 3 · Header ──────────────────────────────────────────── */

export function setupChips(s: Setup) {
  if (!isComplete(s)) return [];
  const lots = s.legs.every((l) => l.lots === 1) ? '1 lot each' : `${s.legs.reduce((a, l) => a + l.lots, 0)} lots`;
  const chips = [
    `${s.index} · ${s.underlying}`,
    `${s.holding} ${s.entryAt} – ${s.exitAt}`,
    `${s.legs.length} leg${s.legs.length > 1 ? 's' : ''} · Options · ${s.legs[0].expiry} · ${lots}`,
    `Square off: ${s.squareOff}`,
  ];
  if (s.sl.on) chips.push(`Overall SL · Max Loss ₹${s.sl.amount.toLocaleString('en-IN')}`);
  if (s.target.on) chips.push(`Overall Target · Max Profit ₹${s.target.amount.toLocaleString('en-IN')}`);
  return chips;
}

function Header({ setup }: { setup: Setup }) {
  const { renameSetup, saveAsSetup, updateSaved, toggleExpanded } = useBacktest();
  const [menu, setMenu] = useState(false);
  const chips = setupChips(setup);

  return (
    <div className="flex h-14 items-center gap-2 border-b border-border-subtle bg-surface-canvas px-5">
      <input
        aria-label="Setup name"
        value={setup.name}
        onChange={(e) => renameSetup(setup.id, e.target.value)}
        className="h-[34px] w-[180px] shrink-0 rounded-control border border-border-control bg-surface px-2.5 font-sans text-[13.5px] font-semibold outline-none focus:border-brand"
      />
      {/* Save question lives here, never next to Run */}
      {!setup.savedId && (
        <button type="button" onClick={() => saveAsSetup(setup.id)} className="h-[34px] shrink-0 rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint">
          Save as setup
        </button>
      )}
      {setup.savedId && setup.editedSinceSave && (
        <button type="button" onClick={() => updateSaved(setup.id)} className="h-[34px] shrink-0 rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint">
          Update setup
        </button>
      )}
      <Popover
        open={menu}
        onClose={() => setMenu(false)}
        trigger={
          <button type="button" aria-label="More setup actions" onClick={() => setMenu((m) => !m)} className="relative flex size-[30px] shrink-0 items-center justify-center rounded-segment-item text-text-secondary hover:bg-surface-selected">
            ⋯
            {setup.newerSavedVersion && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand" />}
          </button>
        }
      >
        <SetupMenu setup={setup} onDone={() => setMenu(false)} />
      </Popover>
      <span className="h-5 w-px shrink-0 bg-border-control" />
      {/* chips scroll sideways, never cut */}
      <div aria-label="Setup details" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pr-6">
        {chips.map((c) => (
          <span key={c} className="flex h-6 shrink-0 items-center rounded-[5px] bg-chip-neutral px-2 text-hint whitespace-nowrap text-text-secondary">
            {c}
          </span>
        ))}
      </div>
      <button type="button" onClick={() => toggleExpanded(setup.id)} className="flex shrink-0 items-center gap-1 text-body font-medium text-brand">
        {setup.expanded ? 'Collapse' : 'Expand'}
        <span className={`inline-block transition-transform ${setup.expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
    </div>
  );
}
