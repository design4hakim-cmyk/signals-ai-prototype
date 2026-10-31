import { useState } from 'react';
import { ChevronDownIcon } from './icons';
import { Popover } from './Popover';

/*
  Select: a field-style dropdown (Expiry, Strike criteria, Strike, Multiply).
  Opens a small list; the chosen option is blue with a ✓ (board K06).
*/

interface SelectProps<T extends string | number> {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  width: number;
  label: string;
  format?: (v: T) => string;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  width,
  label,
  format = String,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label}: ${format(value)}`}
          onClick={() => setOpen((o) => !o)}
          style={{ width }}
          className={`flex h-[34px] items-center justify-between rounded-control border bg-surface px-2.5 text-body text-text-primary ${
            open ? 'border-brand' : 'border-border-chip hover:border-border-strong'
          }`}
        >
          {format(value)}
          <span className="text-text-subtle">
            <ChevronDownIcon size={11} />
          </span>
        </button>
      }
    >
      <div
        role="listbox"
        aria-label={label}
        style={{ minWidth: Math.max(width, 140) }}
        className="flex max-h-[260px] flex-col overflow-auto rounded-block border border-border-control bg-surface p-1.5 shadow-menu"
      >
        {options.map((opt) => {
          const on = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex h-8 shrink-0 items-center justify-between rounded-chip px-2.5 text-left text-body ${
                on ? 'bg-brand-tint font-semibold text-brand-text' : 'text-text-primary hover:bg-surface-hover'
              }`}
            >
              <span>{format(opt)}</span>
              {on && <span>✓</span>}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}

/** Small grey label above a field ("Option type", "Expiry"…) */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-label font-medium text-text-tertiary">{children}</span>;
}
