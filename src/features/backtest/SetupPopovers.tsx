import { useEffect, useState } from 'react';
import { useBacktest, type Setup } from '@/store/backtest';
import { useStrategy } from '@/store/strategy';

/*
  The only three popovers in the setup block. Everything else happens inline.
  A · + Add trade setup   B · ⋯ setup menu   C · Confirm remove
*/

const surface = 'flex flex-col rounded-block border border-border-control bg-surface shadow-popover';

/* A · pick saved setups (multi-select) or add a blank one */
export function AddSetupPopover({ onDone }: { onDone: () => void }) {
  const { saved, setups, addSaved, addBlank } = useBacktest();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const inUse = new Set(setups.map((s) => s.savedId));
  const list = saved.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div role="dialog" aria-label="Add trade setup" className={`${surface} w-[320px] p-1.5`}>
      <input
        autoFocus
        aria-label="Search saved setups"
        placeholder="Search saved setups"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="m-1 mb-1.5 h-8 rounded-segment-item border border-border-control px-2.5 font-sans text-chip outline-none focus:border-brand"
      />
      <button type="button" onClick={() => { addBlank(); onDone(); }} className="flex h-9 items-center gap-2 rounded-segment-item px-2.5 text-body font-medium text-brand hover:bg-row-hover">
        + Blank setup
      </button>
      <span className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-text-tertiary">SAVED SETUPS</span>
      {list.map((s) => {
        const used = inUse.has(s.id);
        const on = picked.includes(s.id);
        return (
          <label key={s.id} className={`flex items-center gap-2.5 rounded-segment-item px-2.5 py-2 ${used ? 'opacity-50' : 'cursor-pointer hover:bg-row-hover'}`}>
            <input
              type="checkbox"
              disabled={used}
              checked={on || used}
              onChange={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
              className="accent-brand"
            />
            <span className="flex flex-col">
              <span className="text-body font-medium">{s.name}</span>
              <span className="text-hint text-text-tertiary">{used ? 'Already added' : s.summary}</span>
            </span>
          </label>
        );
      })}
      <div className="mt-1 flex items-center justify-between border-t border-border-subtle px-2.5 pt-2.5 pb-1">
        <span className="text-label text-text-tertiary">{picked.length} selected</span>
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => { addSaved(picked); onDone(); }}
          className="h-[30px] rounded-segment-item bg-brand px-3 text-body font-medium text-text-on-brand disabled:bg-action-disabled"
        >
          Add {picked.length || ''} setup{picked.length > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

/* B · rare actions. A newer saved version, when one exists, is offered at the top. */
export function SetupMenu({ setup, onDone }: { setup: Setup; onDone: () => void }) {
  const { duplicate, saveAsSetup, takeNewerVersion } = useBacktest();
  const showToast = useStrategy((s) => s.showToast);
  const [confirming, setConfirming] = useState(false);
  if (confirming) return <ConfirmRemove setup={setup} onDone={onDone} />;
  const item = 'rounded-segment-item px-2.5 py-2 text-left text-body hover:bg-row-hover';
  return (
    <div role="menu" aria-label="Setup actions" className={`${surface} w-[260px] p-1.5`}>
      {setup.newerSavedVersion && (
        <button type="button" role="menuitem" className={`${item} flex flex-col`} onClick={() => { takeNewerVersion(setup.id); onDone(); }}>
          <span className="font-medium text-brand">Use the newer saved version</span>
          <span className="text-hint text-text-tertiary">Updated from another strategy. Outdates these results.</span>
        </button>
      )}
      <button type="button" role="menuitem" className={item} onClick={() => { onDone(); showToast('Edit the name in the box on the left'); }}>Rename</button>
      <button type="button" role="menuitem" className={item} onClick={() => { duplicate(setup.id); onDone(); }}>Duplicate as new tab</button>
      <button type="button" role="menuitem" className={`${item} flex flex-col`} onClick={() => { saveAsSetup(setup.id, `${setup.name} v2`); onDone(); }}>
        Save as new setup
        <span className="text-hint text-text-tertiary">Branches an edited copy without touching the original</span>
      </button>
      <div className="my-1 h-px bg-border-subtle" />
      <button type="button" role="menuitem" className={`${item} text-sell-text`} onClick={() => setConfirming(true)}>
        Remove from strategy
      </button>
    </div>
  );
}

/* C · small popover, not a modal. Skipped for blank setups never run (toast instead). */
export function ConfirmRemove({ setup, onDone }: { setup: Setup; onDone: () => void }) {
  const remove = useBacktest((s) => s.remove);
  const showToast = useStrategy((s) => s.showToast);
  // never run: no confirm, just remove with a toast
  useEffect(() => {
    if (setup.everRun) return;
    remove(setup.id);
    showToast(`${setup.name} removed`);
    onDone();
  }, [setup, remove, showToast, onDone]);
  if (!setup.everRun) return null;
  return (
    <div role="dialog" aria-label="Confirm remove" className={`${surface} w-[300px] gap-2 p-4`}>
      <span className="text-body font-semibold">Remove {setup.name} from this strategy?</span>
      <span className="text-label text-text-tertiary">Its results here are cleared. The saved setup stays in your list.</span>
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-[30px] rounded-segment-item border border-border-chip px-3 text-body hover:bg-surface-hover">Cancel</button>
        <button type="button" onClick={() => { remove(setup.id); onDone(); }} className="h-[30px] rounded-segment-item bg-sell px-3 text-body font-medium text-text-on-brand">
          Remove
        </button>
      </div>
    </div>
  );
}
