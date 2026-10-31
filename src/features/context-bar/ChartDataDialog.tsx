import { useState } from 'react';
import { CloseIcon, InfoIcon } from '@/components/ui/icons';
import { longLabel } from '@/lib/describeChartData';
import { chartDataKinds, defaultLeg, templateLegs, unavailableReason } from '@/mock/instruments';
import { useWorkspace } from '@/store/workspace';
import type { ChartData, ChartDataKind } from '@/types/market';
import { CombinedPanel } from './CombinedPanel';
import { OptionPanel } from './OptionPanel';

/*
  Chart data dialog (K02, K06–K10).
  Left: what to plot. Right: its settings. Footer: Cancel / Apply.
  Changes are a "draft" until Apply — Cancel throws them away.
*/

function startFor(kind: ChartDataKind): ChartData {
  switch (kind) {
    case 'option':
      return { kind, leg: { ...defaultLeg } };
    case 'combined':
      return { kind, template: 'Straddle', legs: templateLegs('Straddle') };
    default:
      return { kind };
  }
}

export function ChartDataDialog({ onClose }: { onClose: () => void }) {
  const { instrument, chartData, setChartData } = useWorkspace();
  const [draft, setDraftState] = useState<ChartData>(chartData);
  // Remembers each type's settings while the dialog is open, so
  // Option → Spot → Option brings your option settings back.
  const [remembered, setRemembered] = useState<Partial<Record<ChartDataKind, ChartData>>>({
    [chartData.kind]: chartData,
  });
  const setDraft = (d: ChartData) => {
    setDraftState(d);
    setRemembered((r) => ({ ...r, [d.kind]: d }));
  };
  const switchTo = (kind: ChartDataKind) => setDraft(remembered[kind] ?? startFor(kind));
  const wide = draft.kind === 'combined';

  const canApply = draft.kind !== 'combined' || draft.legs.length > 0;
  const footerNote =
    draft.kind === 'combined'
      ? draft.legs.length
        ? `Chart will show the summed premium of ${draft.legs.length} leg${draft.legs.length > 1 ? 's' : ''}`
        : 'Add at least one leg'
      : '';

  return (
    <div
      role="dialog"
      aria-label="Chart data"
      style={{ width: wide ? 1010 : 640, marginLeft: wide ? -150 : 0 }}
      className="flex flex-col rounded-dialog border border-border-control bg-surface shadow-dialog"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
        <span className="text-body-lg font-semibold">
          Chart data <span className="font-normal text-text-subtle">· {instrument}</span>
        </span>
        <button type="button" aria-label="Close" onClick={onClose} className="text-text-secondary">
          <CloseIcon />
        </button>
      </div>

      <div className="flex min-h-[300px]">
        {/* Left: type list */}
        <div role="radiogroup" aria-label="Chart data type" className="flex w-[200px] shrink-0 flex-col gap-0.5 border-r border-border-subtle p-2">
          {chartDataKinds.map((k) => {
            const on = draft.kind === k.kind;
            const blocked = unavailableReason(k.kind, instrument);
            return (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!!blocked}
                onClick={() => switchTo(k.kind)}
                className={`flex items-start gap-2.5 rounded-control px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                  on ? 'bg-brand-tint' : 'enabled:hover:bg-surface-hover'
                }`}
              >
                <span
                  className={`mt-px size-4 shrink-0 rounded-full ${on ? 'border-[5px] border-brand' : 'border-[1.5px] border-border-radio'}`}
                />
                <span className="flex flex-col gap-px">
                  <span className={`text-body text-text-primary ${on ? 'font-semibold' : 'font-medium'}`}>{k.label}</span>
                  <span className="text-hint text-text-subtle">{blocked ?? k.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: settings for the chosen type */}
        <div className="min-w-0 flex-1 px-5 py-[18px]">
          {draft.kind === 'option' && <OptionPanel leg={draft.leg} onChange={(leg) => setDraft({ kind: 'option', leg })} />}
          {draft.kind === 'combined' && <CombinedPanel value={draft} onChange={setDraft} />}
          {(draft.kind === 'spot' || draft.kind === 'perpetual' || draft.kind === 'synthetic') && (
            <div className="flex items-center gap-2.5 rounded-block bg-surface-hover p-3.5 text-body text-text-secondary">
              <span className="text-text-subtle">
                <InfoIcon />
              </span>
              <span>
                <span className="first-letter:uppercase">{longLabel(draft, instrument)}</span>. No extra settings needed.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
        <span className="flex-1 text-label text-text-tertiary">{footerNote}</span>
        <button
          type="button"
          onClick={onClose}
          className="h-[34px] rounded-control border border-border-chip bg-surface px-3.5 text-body hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={() => {
            setChartData(draft);
            onClose();
          }}
          className="h-[34px] rounded-control bg-brand px-4 text-body font-medium text-text-on-brand hover:bg-brand-hover disabled:bg-action-disabled"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
