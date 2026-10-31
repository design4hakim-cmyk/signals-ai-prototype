import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FieldLabel, Select } from '@/components/ui/Select';
import { criteriaOptions, expiries, strikes } from '@/mock/instruments';
import type { OptionLeg, OptionType, StrikeTiming } from '@/types/market';

/* Option settings (K06 Rolling, K07 Fixed). One leg, edited field by field. */

export function OptionPanel({ leg, onChange }: { leg: OptionLeg; onChange: (l: OptionLeg) => void }) {
  const set = (patch: Partial<OptionLeg>) => onChange({ ...leg, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Strike selection timing</FieldLabel>
        <div className="flex items-center gap-3">
          <SegmentedControl<StrikeTiming>
            label="Strike selection timing"
            options={['Rolling', 'Fixed']}
            value={leg.timing}
            onChange={(timing) => set({ timing })}
          />
          {leg.timing === 'Rolling' ? (
            <span className="text-label text-text-subtle">Re-picks the strike as price moves</span>
          ) : (
            <span className="flex items-center gap-2 text-label text-text-subtle">
              Picks once a day at
              <input
                type="time"
                aria-label="Pick strike at"
                min="09:15"
                max="15:30"
                value={leg.fixedAt}
                onChange={(e) => set({ fixedAt: e.target.value || '09:15' })}
                className="h-[30px] rounded-control border border-border-chip px-2 font-sans text-body text-text-primary outline-none focus:border-brand"
              />
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Option type</FieldLabel>
          <SegmentedControl<OptionType>
            label="Option type"
            options={['Call', 'Put']}
            value={leg.optionType}
            onChange={(optionType) => set({ optionType })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Expiry</FieldLabel>
          <Select label="Expiry" width={140} options={expiries} value={leg.expiry} onChange={(expiry) => set({ expiry })} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strike criteria</FieldLabel>
          <Select
            label="Strike criteria"
            width={200}
            options={criteriaOptions}
            value={leg.criteria}
            onChange={(criteria) => set({ criteria })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{leg.criteria === 'Strike Type' ? 'Strike' : 'Premium (₹)'}</FieldLabel>
          <StrikeField leg={leg} onChange={set} width={110} />
        </div>
      </div>
    </div>
  );
}

/** Strike dropdown, or a ₹ number box when the criteria is premium-based. */
export function StrikeField({
  leg,
  onChange,
  width,
}: {
  leg: OptionLeg;
  onChange: (patch: Partial<OptionLeg>) => void;
  width: number;
}) {
  if (leg.criteria === 'Strike Type') {
    return <Select label="Strike" width={width} options={strikes} value={leg.strike} onChange={(strike) => onChange({ strike })} />;
  }
  return (
    <label style={{ width }} className="flex h-[34px] items-center gap-1 rounded-control border border-border-chip px-2.5 focus-within:border-brand">
      <span className="text-body text-text-subtle">₹</span>
      <input
        type="number"
        min={1}
        aria-label="Premium in rupees"
        value={leg.premium}
        onChange={(e) => onChange({ premium: Math.max(1, Number(e.target.value) || 1) })}
        className="w-full border-0 p-0 font-sans text-body outline-none"
      />
    </label>
  );
}
