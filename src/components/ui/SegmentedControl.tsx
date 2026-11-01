/*
  SegmentedControl: grey track with a white "pill" on the chosen option.
  Seen in: Rolling / Fixed, Call / Put, Build / Backtest, Chart / Log.
*/

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  size?: 'md' | 'sm'; // sm = inside the combined-premium leg rows
  label: string; // read out by screen readers
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  label,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-segment bg-surface-selected p-[3px]">
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt)}
            className={`rounded-segment-item text-body font-medium transition-colors ${
              size === 'md' ? 'h-7 px-4' : 'h-6 px-2.5'
            } ${on ? 'bg-surface text-text-primary shadow-segment' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
