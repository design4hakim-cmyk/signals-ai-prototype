import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { editorRing, type EditorState } from './editorRing';
import { useEditorState } from './useEditorState';

/*
  Small controls of the canvas builder (COMPONENTS.md §4, atoms sheet "Icon controls",
  "Checkbox", "Badges and messages"). App-chrome buttons keep their own fills;
  every focus ring still comes from editorRing().
*/

/** Forced look for Storybook: 'hover' | 'pressed' | 'focused' | 'open' | 'dragging' … */
type Force = 'default' | 'hover' | 'pressed' | 'focused';

const ringFor = (focused: boolean) => editorRing({ focused });

/** Shared: a <button> whose focus ring is the editor ring. */
function useButtonState(force?: Force, disabled = false) {
  const f: EditorState | undefined = force && force !== 'default' ? { inter: force === 'focused' ? 'default' : force, focused: force === 'focused' } : undefined;
  return useEditorState(f, disabled);
}

/* ── Checkbox ──────────────────────────────────────────────────── */

export function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  force,
  label,
  onChange,
}: {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  force?: Force;
  label: string;
  onChange?: (v: boolean) => void;
}) {
  const { state, props } = useButtonState(force, disabled);
  const on = checked || indeterminate;
  const hover = state.inter === 'hover';
  const look = disabled
    ? on
      ? 'border-border-strong bg-border-strong text-surface'
      : 'border-disabled-border bg-disabled-bg'
    : on
      ? `${hover ? 'border-brand-hover bg-brand-hover' : 'border-brand bg-brand'} text-text-on-brand`
      : hover
        ? 'border-brand-border bg-brand-pressed-tint'
        : 'border-border-strong bg-surface';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      disabled={disabled}
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      style={{ boxShadow: ringFor(!!state.focused) }}
      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] outline-none transition-colors disabled:cursor-not-allowed ${look}`}
    >
      {indeterminate ? (
        <span className="h-[2px] w-2 rounded-full bg-current" />
      ) : checked ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : null}
    </button>
  );
}

/* ── The + on the rail (solid blue, 28px, centred on the rail line) ── */

export function RailAddButton({ force, disabled = false, label, onClick }: { force?: Force; disabled?: boolean; label: string; onClick?: () => void }) {
  const { state, props } = useButtonState(force, disabled);
  const fill = disabled ? 'bg-surface-disabled text-text-disabled' : state.inter === 'pressed' ? 'bg-brand-pressed text-text-on-brand' : state.inter === 'hover' ? 'bg-brand-hover text-text-on-brand' : 'bg-brand text-text-on-brand';
  const ring = ringFor(!!state.focused);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...props}
      style={{ boxShadow: [ring, disabled ? '' : 'var(--shadow-rail-add)'].filter(Boolean).join(', ') }}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full outline-none transition-colors disabled:cursor-not-allowed ${fill}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

/* ── ⋯ ─────────────────────────────────────────────────────────── */

export function MoreButton({ force, open = false, disabled = false, label = 'More actions', onClick }: { force?: Force; open?: boolean; disabled?: boolean; label?: string; onClick?: () => void }) {
  const { state, props } = useButtonState(force, disabled);
  const look = open
    ? 'border-brand bg-brand-pressed-tint text-brand'
    : state.inter === 'pressed'
      ? 'border-border-control bg-row-pressed text-text-secondary'
      : state.inter === 'hover'
        ? 'border-border-control bg-surface-selected text-text-secondary'
        : 'border-border-control bg-surface text-text-secondary';
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      disabled={disabled}
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ boxShadow: ringFor(!!state.focused) }}
      className={`flex size-6 shrink-0 items-center justify-center rounded-chip border text-[14px] leading-none outline-none transition-colors ${look}`}
    >
      ⋯
    </button>
  );
}

/* ── ⋮⋮ drag handle ────────────────────────────────────────────── */

export function DragHandle({ force, dragging = false, disabled = false, label = 'Drag to move' }: { force?: Force; dragging?: boolean; disabled?: boolean; label?: string }) {
  const { state, props } = useButtonState(force, disabled);
  const look = disabled
    ? 'cursor-default text-text-disabled'
    : dragging
      ? 'cursor-grabbing bg-brand-pressed-tint text-brand'
      : state.inter === 'hover'
        ? 'cursor-grab bg-surface-selected text-text-subtle'
        : 'cursor-grab text-text-subtle';
  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      {...props}
      style={{ boxShadow: ringFor(!!state.focused) }}
      className={`flex h-6 w-4 shrink-0 items-center justify-center rounded-[4px] outline-none transition-colors ${look}`}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
        {[2, 6, 10].flatMap((y) => [2, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}
      </svg>
    </span>
  );
}

/* ── Buttons (app chrome: keep their own fills, plus the focus ring) ── */

export type KitButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

const BUTTON: Record<KitButtonVariant, { base: string; hover: string; pressed: string; disabled: string }> = {
  primary: {
    base: 'h-9 px-3.5 font-semibold bg-brand text-text-on-brand',
    hover: 'bg-brand-hover',
    pressed: 'bg-brand-pressed',
    disabled: 'bg-surface-disabled text-text-disabled',
  },
  secondary: {
    base: 'h-[30px] px-3 border border-border-chip bg-surface text-text-primary',
    hover: 'bg-surface-hover border-border-strong',
    pressed: 'bg-row-pressed border-border-strong',
    disabled: 'border-disabled-border text-text-disabled',
  },
  tertiary: {
    base: 'h-[30px] px-3 text-brand-text',
    hover: 'bg-brand-tint',
    pressed: 'bg-brand-pressed-tint',
    disabled: 'text-text-disabled',
  },
  destructive: {
    base: 'h-[30px] px-3 border border-border-chip bg-surface text-error',
    hover: 'bg-error-bg border-error-pressed',
    pressed: 'bg-error-pressed border-error-pressed',
    disabled: 'border-disabled-border text-text-disabled',
  },
};

export function KitButton({
  variant = 'secondary',
  force,
  loading = false,
  disabled = false,
  children,
  ...rest
}: { variant?: KitButtonVariant; force?: Force; loading?: boolean; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const { state, props } = useButtonState(force, disabled || loading);
  const v = BUTTON[variant];
  const look = disabled ? v.disabled : state.inter === 'pressed' ? v.pressed : state.inter === 'hover' ? v.hover : '';
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={loading || undefined}
      {...props}
      {...rest}
      style={{ boxShadow: ringFor(!!state.focused) }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control text-body whitespace-nowrap outline-none transition-colors disabled:cursor-not-allowed ${v.base} ${look}`}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ── Badges and messages ───────────────────────────────────────── */

/** ✦ on things Copilot added or changed. Violet = provenance only. */
export const CopilotBadge = () => (
  <span aria-label="Added by Copilot" className="flex size-3.5 items-center justify-center rounded-[4px] border border-copilot-soft bg-copilot-bg text-[8px] leading-none text-copilot">
    ✦
  </span>
);

/** Changed since the last chart update (editor only). */
export const ChangedDot = () => <span aria-label="Changed since update" className="block size-2 rounded-full bg-brand" />;

export const ErrorIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <path d="M12 6.5v7M12 17.2v.3" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export function Message({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <span role={tone === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1.5 text-label ${tone === 'error' ? 'text-error' : 'text-success'}`}>
      {tone === 'error' ? <ErrorIcon /> : <span aria-hidden="true">✓</span>}
      {children}
    </span>
  );
}
