import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { editorRing, type EditorState } from './editorRing';
import { ErrorIcon } from './controls';
import { useEditorState } from './useEditorState';

/*
  Field atoms (COMPONENTS.md §1, atoms sheet §2) and the text input (§2).
  Height 28 · radius 6 · padding 0 8 · 13px/500. Settings like "(9, Close)" are 13/400 grey.
  Own look depends only on WHAT the atom is (family × semantic); the editor ring is added outside.
  Text never truncates.
*/

export type AtomKind = 'operand' | 'value' | 'relation' | 'arithmetic' | 'logic' | 'timing';
export type Semantic = 'normal' | 'empty' | 'error' | 'readonly' | 'disabled';

/** operand + value sit bare on the block; the rest are grey connector chips */
const isConnector = (k: AtomKind) => k !== 'operand' && k !== 'value';

const LOOK: Record<Semantic, string> = {
  normal: '',
  empty: 'bg-surface border-dashed border-border-dashed text-text-subtle font-normal',
  error: 'bg-error-bg border-error text-error',
  readonly: 'bg-readonly-bg border-border-control text-text-primary',
  disabled: 'bg-disabled-bg border-disabled-border text-text-disabled cursor-not-allowed',
};

export interface FieldAtomProps {
  kind: AtomKind;
  semantic?: Semantic;
  /** the main words: "EMA", "Cross Above", "50", "Any of" */
  label?: ReactNode;
  /** grey settings after the name: "(9, Close)" · or a suffix for read-only values: "· lot size" */
  detail?: ReactNode;
  /** popover open on this atom = selected ring */
  open?: boolean;
  /** Storybook: force an editor state */
  force?: EditorState;
  onClick?: () => void;
  /** operand: clicking the grey settings opens settings; clicking the name switches the indicator */
  onDetailClick?: () => void;
}

export function FieldAtom({ kind, semantic = 'normal', label, detail, open = false, force, onClick, onDetailClick }: FieldAtomProps) {
  const disabled = semantic === 'disabled';
  const readonly = semantic === 'readonly';
  const { state, mode, props } = useEditorState(force ?? (open ? { selected: true } : undefined), disabled);
  // read-only: focusable, never selected, no pointer feedback
  const ring = editorRing(readonly ? { focused: state.focused } : state, mode, disabled);
  const own =
    semantic === 'normal'
      ? isConnector(kind)
        ? 'bg-surface-selected border-surface-selected text-text-primary'
        : 'bg-transparent border-transparent text-text-primary'
      : LOOK[semantic];

  const body =
    kind === 'arithmetic' ? (
      // four tiny signs in a 2×2 grid; a set step shows as a value chip like "× 1.5" instead
      <span aria-hidden="true" className="grid grid-cols-2 gap-x-[3px] text-[10px] leading-[9px] font-bold">
        <span>+</span><span>−</span><span>×</span><span>÷</span>
      </span>
    ) : (
      <>
        {semantic === 'error' && <ErrorIcon />}
        <span>{label}</span>
        {detail &&
          (onDetailClick && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              title="Edit settings"
              onClick={(e) => {
                e.stopPropagation();
                onDetailClick();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onDetailClick();
                }
              }}
              className="rounded-[4px] font-normal text-text-subtle outline-none hover:text-text-secondary hover:underline focus-visible:underline"
            >
              {detail}
            </span>
          ) : (
            <span className={`font-normal ${disabled ? '' : 'text-text-subtle'}`}>{detail}</span>
          ))}
        {(kind === 'logic' || kind === 'timing') && <ChevronDownIcon size={11} />}
      </>
    );

  return (
    <button
      type="button"
      disabled={disabled}
      aria-haspopup={readonly ? undefined : 'dialog'}
      aria-expanded={open || undefined}
      aria-label={kind === 'arithmetic' ? 'Arithmetic' : undefined}
      {...props}
      onClick={readonly ? undefined : onClick}
      style={{ boxShadow: ring }}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-chip border text-body font-medium whitespace-nowrap outline-none transition-shadow duration-100 ${
        kind === 'arithmetic' ? 'w-7 justify-center px-0' : 'px-2'
      } ${own}`}
    >
      {body}
    </button>
  );
}

/** "× 1.5" — a set arithmetic step, shown as a value on the operand. */
export const MathChip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-[5px] bg-brand-tint px-1.5 py-0.5 text-label font-semibold text-brand-text">{children}</span>
);

/* ── Text input (inside popovers) ──────────────────────────────── */

export function TextInput({
  error,
  force,
  readOnly,
  disabled,
  width = 120,
  ...rest
}: { /** a message, or true for red without one */ error?: string | boolean; force?: EditorState; width?: number } & InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  const { state, props } = useEditorState(force, disabled);
  // inputs: hover ring + focus ring (any focus — you type in it), no selected state
  const ring = editorRing({ inter: state.inter === 'hover' && !readOnly ? 'hover' : 'default', focused: force?.focused ?? focused }, 'editor', disabled);
  const look = disabled
    ? 'bg-disabled-bg border-disabled-border text-text-disabled'
    : error
      ? 'bg-error-bg border-error text-error'
      : readOnly
        ? 'bg-readonly-bg border-border-control text-text-primary'
        : 'bg-surface border-border-control text-text-primary';
  return (
    <span className="inline-flex flex-col gap-1">
      <input
        {...rest}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={!!error || undefined}
        data-editor-el={props['data-editor-el']}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={{ boxShadow: ring, width }}
        className={`h-7 rounded-chip border px-2 text-body outline-none transition-shadow duration-100 placeholder:text-text-subtle ${look}`}
      />
      {typeof error === 'string' && error && (
        <span className="flex max-w-[180px] items-start gap-1 text-label text-error">
          <span className="mt-0.5"><ErrorIcon /></span>
          {error}
        </span>
      )}
    </span>
  );
}
