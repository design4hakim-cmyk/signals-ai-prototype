import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { TRADE_SETUPS } from '@/mock/savedStrategies';
import { useLibrary, type TradeKind } from '@/store/library';

/*
  The Trade popup: Live trade or Forward test, then choose setups.
  One popup for every way in — the top nav's Trade, a row's Trade in My Strategies,
  and ⋯ → Trade…. It works on a strategy that already runs: it adds one more.
  A placeholder until the Trade phase (ST-S14–S22) designs the full flow.
*/

export function TradePopup() {
  const target = useLibrary((s) => s.tradeFor);
  const close = () => useLibrary.setState({ tradeFor: null });
  const [kind, setKind] = useState<TradeKind>('forward');
  const [picked, setPicked] = useState<string[]>([TRADE_SETUPS[0]]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target]);

  if (!target) return null;
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,22,28,0.28)]" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Trade ${target.name}`}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-[420px] flex-col gap-4 rounded-dialog border border-border-control bg-surface p-5 shadow-dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[16px] font-semibold">Trade</h2>
            <p className="m-0 mt-0.5 text-label text-text-tertiary">{target.name}</p>
          </div>
          <button type="button" aria-label="Close" onClick={close} className="text-text-secondary hover:text-text-primary"><CloseIcon size={16} /></button>
        </div>

        {/* navigation between the two kinds: a segmented control, never filled blue */}
        <div role="tablist" aria-label="Kind of trade" className="flex rounded-segment bg-surface-selected p-[3px]">
          {([['forward', 'Forward test'], ['live', 'Live trade']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`h-8 grow rounded-segment-item text-body font-medium ${kind === k ? 'bg-surface shadow-segment' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 text-label text-text-tertiary">
          {kind === 'forward' ? 'Paper trades with live prices. No real money.' : 'Places real orders through your broker.'}
        </p>

        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1.5 text-label font-medium text-text-secondary">Setups to run</legend>
          {TRADE_SETUPS.map((s) => (
            <label key={s} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-control px-2 text-body hover:bg-surface-hover">
              <input type="checkbox" checked={picked.includes(s)} onChange={() => toggle(s)} className="size-4 accent-brand" />
              {s}
            </label>
          ))}
        </fieldset>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={close} className="mr-auto text-body text-text-tertiary hover:text-text-primary">Cancel</button>
          <button
            type="button"
            disabled={!picked.length}
            onClick={() => useLibrary.getState().trade(target, kind, picked)}
            className="h-[34px] rounded-control bg-brand px-4 text-body font-medium text-text-on-brand hover:bg-brand-hover disabled:bg-action-disabled"
          >
            {kind === 'forward' ? 'Start forward test' : 'Start live trade'}
            {picked.length > 1 ? ` · ${picked.length}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
