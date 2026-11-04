import type { ReactNode, Ref } from 'react';
import { ChangedDot, Checkbox, CopilotBadge, DragHandle, Message, MoreButton } from './controls';
import { DRAG_TILT, editorRing, type EditorState } from './editorRing';
import { useEditorState } from './useEditorState';

/*
  Condition block (COMPONENTS.md §5, atoms-2 §4).
  Own look: white card · 1px border · radius 10 · padding 6 · gap 6.
    copilot  = violet fill + border + ✦ (stays in every editor state)
    error    = red fill + border + the message under the block
    disabled = grey, no editor layer
    dragSource = faded, dashed grey, no ring (the copy you move is `dragging`)
  Controls on hover, press or selection: ☐ at the start, ⋯ then ⋮⋮ at the far right.
  Editing a field: only that field gets the selected ring — the block doesn't change.
*/

export type BlockLook = 'normal' | 'error' | 'copilot' | 'disabled' | 'dragSource' | 'ghost' | 'removing';

/** While some blocks are ticked: can this one join? (behaviour §2 "Select and group") */
export type Joinable = 'none' | 'canJoin' | 'cantJoin';

const OWN: Record<BlockLook, string> = {
  normal: 'bg-surface border-border-control',
  error: 'bg-error-bg border-error',
  copilot: 'bg-copilot-bg border-copilot-border',
  disabled: 'bg-disabled-bg border-disabled-border',
  dragSource: 'bg-disabled-bg border-dashed border-border-dashed opacity-50',
  // design/copilot · Canvas states
  ghost: 'bg-surface border-dashed border-ai-border opacity-85',
  removing: 'bg-sell-tint border-dashed border-sell text-sell-text opacity-80',
};

export interface ConditionBlockProps {
  look?: BlockLook;
  /** the field atoms, left to right */
  children: ReactNode;
  selected?: boolean;
  changed?: boolean;
  joinable?: Joinable;
  /** the moving copy while dragging */
  dragging?: boolean;
  error?: string;
  /** Storybook: force hover / pressed / focused */
  force?: EditorState;
  onToggleSelect?: (v: boolean) => void;
  label?: string;
  /** app: the live ⋯ (with its menu) and ⋮⋮ (with drag listeners); stories use the plain ones */
  moreSlot?: ReactNode;
  handleSlot?: ReactNode;
  /** keep ⋯ and ⋮⋮ visible, e.g. while the ⋯ menu is open */
  keepControls?: boolean;
  nodeId?: string;
  blockRef?: Ref<HTMLDivElement>;
  /** Copilot: its card row is hovered, so show this block's hover ring */
  linked?: boolean;
  /** Copilot wants to change this block (dashed blue outline until Apply) */
  pendingChange?: boolean;
  /** a Pine Script Run just changed it: one soft glow */
  glow?: boolean;
}

export function ConditionBlock({
  look = 'normal',
  children,
  selected = false,
  changed = false,
  joinable = 'none',
  dragging = false,
  error,
  force,
  onToggleSelect,
  label = 'Condition',
  moreSlot,
  handleSlot,
  keepControls = false,
  nodeId,
  blockRef,
  linked = false,
  pendingChange = false,
  glow = false,
}: ConditionBlockProps) {
  const disabled = look === 'disabled';
  const source = look === 'dragSource' || look === 'ghost';
  const { state, mode, props } = useEditorState({ ...force, inter: force?.inter ?? (linked ? 'hover' : undefined), selected: selected || dragging || force?.selected, lifted: dragging }, disabled || source);
  const editor = mode === 'editor' && !disabled && !source;
  const engaged = state.inter !== 'default' || !!state.selected;
  // Controls show while the pointer is anywhere in the block (CSS group-hover), even over a field;
  // the hover RING still marks only the innermost element.
  const pinned = engaged || keepControls;
  const showCheck = editor && !dragging;
  const checkCls = pinned || joinable === 'canJoin' ? 'flex' : 'hidden group-hover/block:flex';
  const showMenu = editor && !dragging;
  const menuCls = pinned ? 'flex' : 'hidden group-hover/block:flex';

  return (
    <div className={`inline-flex flex-col gap-1.5 ${joinable === 'cantJoin' ? 'opacity-50' : ''}`}>
      <div
        ref={blockRef}
        data-node-id={nodeId}
        role="group"
        aria-label={label}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        {...props}
        style={{ boxShadow: editorRing(state, mode, disabled || source), transform: dragging ? DRAG_TILT : undefined, ...(pendingChange ? { outline: '1.5px dashed var(--color-brand)', outlineOffset: 3 } : {}) }}
        className={`group/block relative inline-flex w-max max-w-[640px] flex-wrap items-center gap-1.5 rounded-block border p-1.5 outline-none transition-shadow duration-100 ${OWN[look]} ${
          disabled ? 'cursor-not-allowed text-text-disabled' : ''
        }`}
      >
        {glow && <span aria-hidden="true" className="pointer-events-none absolute -inset-px animate-glow rounded-block" />}
        {(look === 'copilot' || look === 'ghost') && (
          <span className="absolute -top-2 -left-2">
            <CopilotBadge />
          </span>
        )}
        {changed && editor && (
          <span className="absolute -top-1 -right-1">
            <ChangedDot />
          </span>
        )}
        {showCheck && (
          <span className={checkCls}>
            <Checkbox label={`Select ${label}`} checked={!!state.selected} onChange={onToggleSelect} />
          </span>
        )}
        {children}
        {showMenu && (
          <span className={`ml-auto items-center gap-0.5 pl-1 ${menuCls}`}>
            {moreSlot ?? <MoreButton />}
            {handleSlot ?? <DragHandle />}
          </span>
        )}
      </div>
      {error && <Message tone="error">{error}</Message>}
      {look === 'removing' && <span className="text-[11px] font-semibold text-sell-text">Will be removed</span>}
    </div>
  );
}
