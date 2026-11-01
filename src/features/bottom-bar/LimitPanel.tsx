import { useState } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import type { Limits } from '@/lib/signals';
import { useWorkspace } from '@/store/workspace';
import { useAppliedChart } from './useSignals';

/*
  Limits (K12 states 11–12). A small panel per limit; applies RIGHT AWAY
  (no chart update needed). Stepper, "No limit", and the effect on entries.
*/

type Key = keyof Limits;

const COPY: Record<Key, { label: string; title: string; body: string }> = {
  openAtOnce: {
    label: 'Open at once',
    title: 'Trades open at the same time',
    body: 'A new entry waits until an open trade exits. Applies right away; no chart update needed.',
  },
  perDay: {
    label: 'Per day',
    title: 'Max entries in a day',
    body: 'After this many entries, new ones wait for the next session. Applies right away.',
  },
};

export function LimitsGroup() {
  const limits = useWorkspace((s) => s.limits);
  const [open, setOpen] = useState<Key | null>(null);
  return (
    <div className="flex items-center gap-2">
      <span className="text-label text-text-subtle">Limits</span>
      <div className="flex rounded-segment border border-border-control bg-surface">
        {(['openAtOnce', 'perDay'] as Key[]).map((k, i) => (
          <Popover
            key={k}
            open={open === k}
            align="right"
            onClose={() => setOpen(null)}
            trigger={
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(open === k ? null : k)}
                className={`flex h-8 items-center gap-[7px] px-[11px] text-body whitespace-nowrap ${i ? 'border-l border-border-control' : 'rounded-l-segment'} ${
                  open === k ? 'bg-brand-tint' : 'hover:bg-surface-hover'
                } ${i ? 'rounded-r-segment' : ''}`}
              >
                <span className="text-label text-text-subtle">{COPY[k].label}</span>
                <span className="font-semibold">{limits[k] ?? '∞'}</span>
                <span className="text-text-subtle"><ChevronDownIcon size={11} /></span>
              </button>
            }
          >
            {/* opens upward: the bar sits at the bottom of the screen */}
            <div className="absolute right-0 bottom-12">
              <LimitPanel k={k} onDone={() => setOpen(null)} />
            </div>
          </Popover>
        ))}
      </div>
    </div>
  );
}

function LimitPanel({ k, onDone }: { k: Key; onDone: () => void }) {
  const { limits, setLimits } = useWorkspace();
  const { signals, unlimited, applied } = useAppliedChart();
  const value = limits[k];
  const after = signals?.entries ?? 0;
  const set = (v: number | null) => setLimits({ [k]: v });

  return (
    <div role="dialog" aria-label={COPY[k].title} className="flex w-[300px] flex-col gap-3 rounded-block border border-border-control bg-surface p-4 shadow-popover">
      <div className="flex flex-col gap-1">
        <span className="text-body font-semibold">{COPY[k].title}</span>
        <span className="text-label text-text-tertiary">{COPY[k].body}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-control border border-border-chip">
          <button type="button" aria-label="Decrease" disabled={value === null || value <= 1} onClick={() => set((value ?? 1) - 1)} className="size-8 text-[16px] disabled:text-text-disabled">−</button>
          <span className="w-8 text-center text-body font-semibold tabular-nums">{value ?? '∞'}</span>
          <button type="button" aria-label="Increase" onClick={() => set((value ?? 0) + 1)} className="size-8 text-[16px]">+</button>
        </div>
        <label className="flex items-center gap-2 text-body text-text-secondary">
          <input type="checkbox" checked={value === null} onChange={(e) => set(e.target.checked ? null : 1)} className="accent-brand" />
          No limit
        </label>
      </div>
      <div className="flex items-center justify-between border-t border-border-subtle pt-3">
        <span className="text-label text-text-tertiary">
          Entries in {applied.period}: <b className="font-semibold text-text-primary tabular-nums">{unlimited?.entries ?? 0} → {after}</b>
        </span>
        <button type="button" onClick={onDone} className="h-[30px] rounded-segment-item bg-brand px-3 text-body font-medium text-text-on-brand hover:bg-brand-hover">
          Done
        </button>
      </div>
    </div>
  );
}
