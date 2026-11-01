import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FieldLabel, Select } from '@/components/ui/Select';
import { criteriaOptions, expiries, MAX_LEGS, multiplyOptions, newLeg, templateLegs } from '@/mock/instruments';
import type { ChartData, CombinedLeg, CombinedTemplate, OptionType, StrikeTiming } from '@/types/market';
import { StrikeField } from './OptionPanel';

/*
  Combined premium (K08): pick a template or build up to 4 legs.
  Editing any leg turns the template into "custom" (no chip selected),
  so the chip never claims a shape the legs no longer match.
*/

type Combined = Extract<ChartData, { kind: 'combined' }>;
const TEMPLATES: CombinedTemplate[] = ['Straddle', 'Strangle', 'Iron Condor', 'Iron Fly'];
const COLS = '18px 64px 96px 118px 120px 150px 86px 18px';
const fmtMultiply = (m: number) => (m < 0 ? `−${-m}` : String(m));

export function CombinedPanel({ value, onChange }: { value: Combined; onChange: (v: Combined) => void }) {
  const { legs, template } = value;
  const full = legs.length >= MAX_LEGS;

  const updateLeg = (id: string, patch: Partial<CombinedLeg>) =>
    onChange({ kind: 'combined', template: null, legs: legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Start from a template</FieldLabel>
        <div className="flex gap-2">
          {TEMPLATES.map((t) => {
            const on = t === template;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ kind: 'combined', template: t, legs: templateLegs(t) })}
                className={`h-[30px] rounded-pill border px-3 text-chip font-medium ${
                  on ? 'border-brand bg-brand-tint text-brand-text' : 'border-border-chip bg-surface hover:bg-surface-hover'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <FieldLabel>Legs</FieldLabel>
          <span className="text-label text-text-subtle">
            {legs.length} of {MAX_LEGS}
            {full && ' · maximum reached'}
          </span>
        </div>

        <div className="overflow-hidden rounded-block border border-border-control bg-surface">
          <div className="grid gap-2 px-2.5 pt-2 pb-0.5 text-[11px] text-text-subtle" style={{ gridTemplateColumns: COLS }}>
            <span />
            <span>Multiply</span>
            <span>Type</span>
            <span>Strike timing</span>
            <span>Expiry</span>
            <span>Strike criteria</span>
            <span>Strike</span>
            <span />
          </div>

          {legs.map((leg, i) => (
            <div
              key={leg.id}
              className="grid items-center gap-2 border-b border-border-subtle px-2.5 py-[7px]"
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="text-[11px] text-text-subtle">{i + 1}</span>
              <Select
                label={`Leg ${i + 1} multiply`}
                width={64}
                options={multiplyOptions}
                value={leg.multiply}
                format={fmtMultiply}
                onChange={(multiply) => updateLeg(leg.id, { multiply })}
              />
              <SegmentedControl<OptionType>
                size="sm"
                label={`Leg ${i + 1} type`}
                options={['Call', 'Put']}
                value={leg.optionType}
                onChange={(optionType) => updateLeg(leg.id, { optionType })}
              />
              <Select<StrikeTiming>
                label={`Leg ${i + 1} strike timing`}
                width={118}
                options={['Rolling', 'Fixed']}
                value={leg.timing}
                onChange={(timing) => updateLeg(leg.id, { timing })}
              />
              <Select
                label={`Leg ${i + 1} expiry`}
                width={120}
                options={expiries}
                value={leg.expiry}
                onChange={(expiry) => updateLeg(leg.id, { expiry })}
              />
              <Select
                label={`Leg ${i + 1} strike criteria`}
                width={150}
                options={criteriaOptions}
                value={leg.criteria}
                onChange={(criteria) => updateLeg(leg.id, { criteria })}
              />
              <StrikeField leg={leg} width={86} onChange={(p) => updateLeg(leg.id, p)} />
              <button
                type="button"
                aria-label={`Remove leg ${i + 1}`}
                onClick={() => onChange({ kind: 'combined', template: null, legs: legs.filter((l) => l.id !== leg.id) })}
                className="text-[15px] text-text-subtle hover:text-sell"
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            disabled={full}
            onClick={() => onChange({ kind: 'combined', template: null, legs: [...legs, newLeg()] })}
            className="h-9 w-full px-3 text-left text-chip font-medium text-brand enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-line-node"
          >
            + Add leg{full ? ` · max ${MAX_LEGS}` : ''}
          </button>
        </div>
        <span className="text-label text-text-tertiary">
          Multiply −1 sells the leg, 1 buys it. The chart plots the summed premium of all legs.
        </span>
      </div>
    </div>
  );
}
