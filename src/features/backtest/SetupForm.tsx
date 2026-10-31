import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { useBacktest, type Setup, type SetupConfig, type SetupLeg } from '@/store/backtest';

/*
  Layer 4 · Setup body — the inputs. Three sections:
  INSTRUMENT AND ENTRY · LEGS · OVERALL STRATEGY.
  Any change outdates only this tab (and offers Update setup if it's a saved one).
*/

const STRIKES = ['ITM3', 'ITM2', 'ITM1', 'ATM', 'OTM1', 'OTM2', 'OTM3', 'OTM4', 'OTM5', 'OTM6'];
let legN = 1000;

export function SetupForm({ setup }: { setup: Setup }) {
  const edit = useBacktest((s) => s.edit);
  const set = (patch: Partial<SetupConfig>) => edit(setup.id, patch);
  const setLeg = (id: string, patch: Partial<SetupLeg>) =>
    set({ legs: setup.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  return (
    <div className="flex flex-col gap-4 border-b border-border-subtle bg-surface-canvas px-5 pt-3.5 pb-[18px]">
      <Section title="INSTRUMENT AND ENTRY">
        <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2.5">
          <Field label="Index">
            <Select label="Index" width={110} options={['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX'] as const} value={setup.index} onChange={(index) => set({ index })} />
          </Field>
          <Field label="Underlying from">
            <Seg options={['Cash', 'Futures'] as const} value={setup.underlying} onChange={(underlying) => set({ underlying })} />
          </Field>
          <Seg options={['Intraday', 'BTST', 'Positional'] as const} value={setup.holding} onChange={(holding) => set({ holding })} />
          <Field label="Entry">
            <TimeInput value={setup.entryAt} onChange={(entryAt) => set({ entryAt })} label="Entry time" />
          </Field>
          <Field label="Exit">
            <TimeInput value={setup.exitAt} onChange={(exitAt) => set({ exitAt })} label="Exit time" />
          </Field>
          <Field label="Square off">
            <Seg options={['Partial', 'Complete'] as const} value={setup.squareOff} onChange={(squareOff) => set({ squareOff })} />
          </Field>
        </div>
      </Section>

      <Section title="LEGS">
        <div className="rounded-block border border-border-control bg-surface">
          <div className="grid grid-cols-[18px_64px_110px_70px_120px_100px_90px_18px] gap-2 px-3 pt-2.5 pb-0.5 text-label text-text-tertiary">
            <span />
            <span>Position</span>
            <span>Segment</span>
            <span>Type</span>
            <span>Strike</span>
            <span>Expiry</span>
            <span>Total lot</span>
            <span />
          </div>
          {setup.legs.map((l, i) => (
            <div key={l.id} className="grid grid-cols-[18px_64px_110px_70px_120px_100px_90px_18px] items-center gap-2 px-3 py-2">
              <span className="text-hint text-text-subtle">{i + 1}</span>
              <button
                type="button"
                aria-label={`Leg ${i + 1} position: ${l.position}. Click to switch`}
                onClick={() => setLeg(l.id, { position: l.position === 'BUY' ? 'SELL' : 'BUY' })}
                className={`h-8 rounded-chip text-label font-semibold ${l.position === 'BUY' ? 'bg-chip-buy-bg text-chip-buy-text' : 'bg-chip-sell-bg text-chip-sell-text'}`}
              >
                {l.position}
              </button>
              <Select label={`Leg ${i + 1} segment`} width={110} options={['Options', 'Futures'] as const} value={l.segment} onChange={(segment) => setLeg(l.id, { segment })} />
              <Select label={`Leg ${i + 1} type`} width={70} options={['CE', 'PE'] as const} value={l.type} onChange={(type) => setLeg(l.id, { type })} />
              <Select label={`Leg ${i + 1} strike`} width={120} options={STRIKES} value={l.strike} format={(v) => v || 'Select strike'} onChange={(strike) => setLeg(l.id, { strike })} />
              <Select label={`Leg ${i + 1} expiry`} width={100} options={['Weekly', 'Monthly'] as const} value={l.expiry} onChange={(expiry) => setLeg(l.id, { expiry })} />
              <Select label={`Leg ${i + 1} lots`} width={90} options={[1, 2, 3, 4, 5]} value={l.lots} format={(v) => `${v} lot${v > 1 ? 's' : ''}`} onChange={(lots) => setLeg(l.id, { lots })} />
              <button type="button" aria-label={`Remove leg ${i + 1}`} disabled={setup.legs.length === 1} onClick={() => set({ legs: setup.legs.filter((x) => x.id !== l.id) })} className="text-[15px] text-text-disabled enabled:hover:text-sell disabled:opacity-30">
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ legs: [...setup.legs, { id: `leg-${++legN}`, position: 'BUY', segment: 'Options', type: 'CE', strike: '', expiry: 'Weekly', lots: 1 }] })}
            className="h-10 w-full border-t border-border-subtle px-4 text-left text-body font-medium text-brand hover:bg-surface-hover"
          >
            + Add leg
          </button>
        </div>
      </Section>

      <Section title="OVERALL STRATEGY">
        <div className="flex flex-wrap items-center gap-x-[26px] gap-y-3">
          <Field label="">
            <Switch on={setup.sl.on} label="Overall SL" onChange={(on) => set({ sl: { ...setup.sl, on } })} />
            <span>Overall SL</span>
            <span className="flex h-[30px] w-[120px] items-center rounded-chip border border-border-control bg-surface px-2.5 text-[12.5px]">Max Loss</span>
            <Money value={setup.sl.amount} disabled={!setup.sl.on} label="Max loss" onChange={(amount) => set({ sl: { ...setup.sl, amount } })} />
          </Field>
          <Field label="">
            <Switch on={setup.target.on} label="Overall Target" onChange={(on) => set({ target: { ...setup.target, on } })} />
            <span>Overall Target</span>
            <span className="flex h-[30px] w-[124px] items-center rounded-chip border border-border-control bg-surface px-2.5 text-[12.5px]">Max Profit</span>
            <Money value={setup.target.amount} disabled={!setup.target.on} label="Max profit" onChange={(amount) => set({ target: { ...setup.target, amount } })} />
          </Field>
          {['Re-entry on SL', 'Re-entry on Target', 'Trailing'].map((t) => (
            <Field key={t} label="">
              <Switch on={false} label={t} disabled />
              <span className="text-text-subtle">{t}</span>
            </Field>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-semibold text-text-tertiary">{title}</span>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[12.5px] text-text-secondary">
      {label && <span>{label}</span>}
      {children}
    </span>
  );
}

function Seg<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="flex rounded-control bg-surface-selected p-[3px]">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={`h-[26px] rounded-chip px-3 text-[12.5px] font-medium ${o === value ? 'bg-surface text-text-primary shadow-segment' : 'text-text-tertiary hover:text-text-primary'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** 24-hour HH:MM, as on the sheet. Checks the value when you leave the field. */
function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      placeholder="HH:MM"
      value={draft}
      maxLength={5}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (valid ? onChange(draft) : setDraft(value))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`h-[30px] w-[66px] rounded-chip border bg-surface px-2 font-sans text-[12.5px] tabular-nums outline-none ${valid ? 'border-border-control focus:border-brand' : 'border-sell'}`}
    />
  );
}

function Money({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  return (
    <input
      type="number"
      aria-label={label}
      min={0}
      step={500}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="h-[30px] w-[88px] rounded-chip border border-border-control bg-surface px-2 font-sans text-[12.5px] outline-none focus:border-brand disabled:opacity-50"
    />
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={`relative h-[18px] w-8 shrink-0 rounded-[9px] transition-colors disabled:opacity-50 ${on ? 'bg-buy' : 'bg-border-radio'}`}
    >
      <span className={`absolute top-0.5 size-3.5 rounded-full bg-surface transition-[left] ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}
