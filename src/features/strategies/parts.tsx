import type { ReactNode, Ref } from 'react';
import { CloseIcon } from '@/components/ui/icons';

/*
  Atoms of the My Strategies panel (design/strategies-panel/COMPONENTS.md · Atoms).
  `force` shows a state in Storybook; in the app hover/press/focus come from CSS.
  Keyboard focus is always the ring (--shadow-focus-ring / --shadow-focus-inset).
*/

export type Force = 'default' | 'hover' | 'pressed' | 'focused';

/* ── Index icon: the instrument's logo, or a letter on its tint ── */

const TILE: Record<string, string> = {
  NIFTY: 'bg-tile-nifty-bg text-tile-nifty',
  SENSEX: 'bg-tile-sensex-bg text-tile-sensex',
  ETH: 'bg-tile-eth-bg text-tile-eth',
  BTC: 'bg-tile-btc-bg text-tile-btc',
  GROWW: 'bg-tile-groww-bg text-tile-groww',
  ASIANPAINT: 'bg-tile-asianpaint-bg text-tile-asianpaint',
};

export function IndexIcon({ symbol, logoUrl }: { symbol: string; logoUrl?: string }) {
  if (logoUrl) return <img src={logoUrl} alt="" className="size-[30px] shrink-0 rounded-[7px] object-cover" />;
  return (
    <span aria-hidden="true" className={`flex size-[30px] shrink-0 items-center justify-center rounded-[7px] text-label font-bold ${TILE[symbol] ?? 'bg-chip-neutral text-text-secondary'}`}>
      {symbol[0]}
    </span>
  );
}

/* ── Running chips: information only, no hover, no click ───────── */

export function RunningChips({ live, forwardTests }: { live: number; forwardTests: number }) {
  if (!live && !forwardTests) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {live > 0 && (
        <span title={`${live} live trade${live > 1 ? 's' : ''} running`} className="inline-flex h-[18px] items-center gap-1 rounded-[5px] bg-success-bg px-1.5 text-[11px] font-semibold text-success">
          <span className="size-[5px] rounded-full bg-success" />
          {live} Live
        </span>
      )}
      {forwardTests > 0 && (
        <span title={`${forwardTests} forward test${forwardTests > 1 ? 's' : ''} running`} className="inline-flex h-[18px] items-center rounded-[5px] bg-menu-current px-1.5 text-[11px] font-semibold text-brand-text">
          {forwardTests} FT
        </span>
      )}
    </span>
  );
}

/* ── Trade: small, outlined blue — never competes with the page's one filled-blue action ── */

export function TradeButton({ force, disabled = false, onClick, title }: { force?: Force; disabled?: boolean; onClick?: () => void; title?: string }) {
  const look = disabled
    ? 'border-border-control bg-surface-hover text-text-disabled'
    : force === 'pressed'
      ? 'border-brand-pressed bg-brand-pressed-tint text-brand-pressed'
      : force === 'hover'
        ? 'border-brand bg-brand-tint text-brand'
        : 'border-brand bg-surface text-brand hover:bg-brand-tint active:border-brand-pressed active:bg-brand-pressed-tint active:text-brand-pressed';
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`h-[26px] shrink-0 rounded-chip border px-2.5 text-label font-semibold outline-none focus-visible:shadow-focus-ring disabled:cursor-not-allowed ${look} ${force === 'focused' ? 'shadow-focus-ring' : ''}`}
    >
      Trade
    </button>
  );
}

/* ── Icon buttons: ⋯ on rows, pin / unpin in the header ────────── */

const ICON = {
  more: <span className="text-[15px] leading-none tracking-[1px]">⋯</span>,
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />
    </svg>
  ),
  // pinned: the "side panel" icon closes it
  unpin: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </svg>
  ),
};

export function IconButton({
  kind,
  label,
  force,
  open = false,
  onClick,
  buttonRef,
}: {
  kind: keyof typeof ICON;
  label: string;
  force?: Force;
  open?: boolean;
  onClick?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const look = open
    ? 'bg-brand-pressed-tint text-brand'
    : force === 'pressed'
      ? 'bg-row-pressed text-text-secondary'
      : force === 'hover'
        ? 'bg-surface-selected text-text-secondary'
        : 'text-text-secondary hover:bg-surface-selected active:bg-row-pressed';
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={kind === 'more' ? open : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex size-[26px] shrink-0 items-center justify-center rounded-chip outline-none focus-visible:shadow-focus-ring ${look} ${force === 'focused' ? 'shadow-focus-ring' : ''}`}
    >
      {ICON[kind]}
    </button>
  );
}

export const ChevronIcon = ({ up = false }: { up?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={`shrink-0 text-text-secondary transition-transform ${up ? 'rotate-180' : ''}`}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/* ── Search field: 38px, a clear × once there's text ───────────── */

export function SearchField({ value, onChange, force, inputRef }: { value: string; onChange: (v: string) => void; force?: Force; inputRef?: Ref<HTMLInputElement> }) {
  const look = force === 'hover' ? 'border-border-strong' : 'border-border-control hover:border-border-strong';
  return (
    <label
      className={`flex h-[38px] items-center gap-2 rounded-control border bg-surface px-3 text-text-subtle focus-within:shadow-focus-ring ${look} ${force === 'focused' ? 'shadow-focus-ring' : ''}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && value && (e.stopPropagation(), onChange(''))}
        placeholder="Search strategy"
        aria-label="Search strategy"
        className="min-w-0 grow bg-transparent text-body text-text-primary outline-none placeholder:text-text-subtle"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="flex size-5 items-center justify-center rounded-[4px] text-text-secondary hover:bg-surface-selected">
          <CloseIcon size={13} />
        </button>
      )}
    </label>
  );
}

/* ── Name field (rename in place) ──────────────────────────────── */

export const ErrorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0">
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <path d="M12 6.5v7M12 17.2v.3" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export function NameInput({
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  autoFocus = true,
}: {
  value: string;
  error?: string | null;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <span className="flex w-full flex-col gap-1">
      <input
        value={value}
        autoFocus={autoFocus}
        aria-label="Strategy name"
        aria-invalid={!!error || undefined}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation(); // keep list shortcuts out of the field
          if (e.key === 'Enter') onSubmit?.();
          if (e.key === 'Escape') onCancel?.();
        }}
        onBlur={onCancel}
        className={`h-7 w-full rounded-chip border px-2 text-body font-medium shadow-focus-ring outline-none ${
          error ? 'border-error bg-error-bg text-error' : 'border-border-control bg-surface text-text-primary'
        }`}
      />
      {error ? (
        <span role="alert" className="flex items-start gap-1 text-hint text-error"><ErrorIcon />{error}</span>
      ) : (
        <span className="text-[11px] text-text-subtle">Enter to save · Esc to cancel</span>
      )}
    </span>
  );
}

/* ── Toast: bottom of the panel, white surface ─────────────────── */

export function PanelToast({ text, onUndo }: { text: ReactNode; onUndo?: () => void }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-control border border-border-control bg-surface py-1.5 pr-1.5 pl-3 text-label shadow-surface">
      <span className="grow">{text}</span>
      {onUndo && (
        <button type="button" onClick={onUndo} className="h-[26px] rounded-chip border border-border-chip px-2.5 text-label font-medium hover:bg-surface-hover focus-visible:shadow-focus-ring">
          Undo
        </button>
      )}
    </div>
  );
}
