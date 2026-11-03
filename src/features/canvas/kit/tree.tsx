import { Children, isValidElement, type HTMLAttributes, type ReactNode } from 'react';
import { FieldAtom } from './atoms';
import { Checkbox, DragHandle, KitButton, Message, MoreButton, RailAddButton } from './controls';
import { DRAG_TILT, dropStyle, editorRing, type DropState, type EditorState } from './editorRing';
import type { LogicWord } from './data';
import { useEditorMode, useEditorState } from './useEditorState';
import type { Joinable } from './ConditionBlock';

/*
  How blocks hang together (COMPONENTS.md §6–7, atoms-2 §5–6).
    Rail     — the grey line with a stub to each row
    LogicGroup — dashed box, ONE node (All of / Any of / None of) on its top edge.
                 Hover/selected: ☐ + node top-left, ⋯ + ⋮⋮ top-right.
                 Logic menu open: only the node is selected; the box stays neutral.
    SectionShell — Entry / Exit. No border of its own; its own rings around the
                 whole section, never because a child is selected.
*/

/* ── Rail ──────────────────────────────────────────────────────── */

export function Rail({ children, insertAt }: { children: ReactNode; /** blue insert line before this row (drag) */ insertAt?: number }) {
  const rows = Children.toArray(children);
  return (
    <div className="relative flex flex-col gap-2.5 pl-[22px]">
      <span aria-hidden="true" className="absolute top-0 bottom-3 left-[6px] w-px bg-line-connector" />
      {rows.map((row, i) => (
        // data-flip: rows glide to their new place when the tree changes (smart animate)
        <div key={isValidElement(row) ? row.key : i} data-flip={isValidElement(row) && row.key ? String(row.key).replace(/^\.\$/, '') : undefined} className="relative">
          {insertAt === i && <span aria-hidden="true" className="absolute -top-[7px] -left-[16px] h-[2px] w-[260px] rounded-full bg-brand" />}
          <span aria-hidden="true" className="absolute top-[19px] -left-[16px] h-px w-3 bg-line-connector" />
          {row}
        </div>
      ))}
      {insertAt === rows.length && <span aria-hidden="true" className="h-[2px] w-[260px] -translate-x-4 rounded-full bg-brand" />}
    </div>
  );
}

/* ── Logic group ───────────────────────────────────────────────── */

export interface LogicGroupProps {
  word?: LogicWord;
  children: ReactNode;
  selected?: boolean;
  /** logic menu open: the node is selected, the group stays neutral */
  nodeOpen?: boolean;
  joinable?: Joinable;
  drop?: DropState;
  /** invalid drop: the reason in words */
  dropReason?: string;
  dragging?: boolean;
  force?: EditorState;
  /** app slots: the live logic node (with its menu), ⋯ (with its menu), ⋮⋮ (with drag listeners) */
  nodeSlot?: ReactNode;
  moreSlot?: ReactNode;
  handleSlot?: ReactNode;
  keepControls?: boolean;
  onToggleSelect?: (v: boolean) => void;
  insertAt?: number;
  nodeId?: string;
  /** why it can't join the selection (shown on hover) */
  cantJoinReason?: string;
}

export function LogicGroup({
  word = 'Any of',
  children,
  selected = false,
  nodeOpen = false,
  joinable = 'none',
  drop = 'none',
  dropReason,
  dragging = false,
  force,
  nodeSlot,
  moreSlot,
  handleSlot,
  keepControls = false,
  onToggleSelect,
  insertAt,
  nodeId,
  cantJoinReason,
}: LogicGroupProps) {
  const { state, mode, props } = useEditorState({ ...force, selected: selected || dragging || force?.selected, lifted: dragging });
  const editor = mode === 'editor';
  const engaged = state.inter !== 'default' || !!state.selected;
  return (
    <div className={`inline-flex flex-col gap-1.5 ${joinable === 'cantJoin' ? 'opacity-50' : ''}`} title={joinable === 'cantJoin' ? cantJoinReason : undefined}>
      <div
        data-node-id={nodeId}
        role="group"
        aria-label={`${word} group`}
        tabIndex={0}
        {...props}
        style={{
          boxShadow: drop !== 'none' ? '' : editorRing(state, mode),
          transform: dragging ? DRAG_TILT : undefined,
          ...dropStyle(drop, mode),
        }}
        className="relative mt-3 rounded-block border border-dashed border-group-edge bg-group-bg px-3 pt-5 pb-3 outline-none transition-shadow duration-100"
      >
        {/* top edge: ☐ + node on the left, ⋯ + ⋮⋮ on the right */}
        <div className="absolute -top-3.5 left-2.5 flex items-center gap-1.5 bg-group-bg px-1">
          {editor && (engaged || joinable === 'canJoin') && (
            <Checkbox label={`Select ${word} group`} checked={!!state.selected && !dragging} onChange={onToggleSelect} />
          )}
          {nodeSlot ?? <FieldAtom kind="logic" label={word} open={nodeOpen} />}
        </div>
        {editor && (engaged || keepControls) && !dragging && (
          <div className="absolute -top-3 right-2.5 flex items-center gap-0.5 bg-group-bg px-1">
            {moreSlot ?? <MoreButton label="Group actions" />}
            {handleSlot ?? <DragHandle />}
          </div>
        )}
        <Rail insertAt={insertAt}>{children}</Rail>
      </div>
      {drop === 'invalid' && dropReason && <Message tone="error">{dropReason}</Message>}
    </div>
  );
}

/* ── Section shell: Entry / Exit ───────────────────────────────── */

export interface SectionShellProps {
  side: 'entry' | 'exit';
  /** section root logic, shown only with 2+ conditions */
  word?: LogicWord;
  children?: ReactNode;
  selected?: boolean;
  drop?: DropState;
  force?: EditorState;
  /** app slots: the live timing chip and root logic node (each with a menu) */
  timingSlot?: ReactNode;
  logicSlot?: ReactNode;
  onAdd?: () => void;
  /** e.g. pointer handlers that drag the whole section by its header */
  headerProps?: HTMLAttributes<HTMLDivElement>;
  insertAt?: number;
  /** shown before the title, e.g. a grip that says the section can be dragged */
  titleAddon?: ReactNode;
}

export function SectionShell({ side, word = 'All of', children, selected = false, drop = 'none', force, timingSlot, logicSlot, onAdd, headerProps, insertAt, titleAddon }: SectionShellProps) {
  const { state, mode, props } = useEditorState({ ...force, selected: selected || force?.selected });
  const rows = Children.toArray(children);
  const title = side === 'entry' ? 'Entry' : 'Exit';
  const editor = useEditorMode() === 'editor';
  return (
    <section
      aria-label={`${title} conditions`}
      tabIndex={0}
      {...props}
      style={{ boxShadow: drop !== 'none' ? '' : editorRing(state, mode), ...dropStyle(drop, mode) }}
      className="inline-flex min-w-[340px] flex-col gap-2.5 rounded-card p-4 outline-none transition-shadow duration-100"
    >
      <div {...headerProps}>
        <h3 className="m-0 flex items-center gap-1.5 text-title font-semibold">{titleAddon}{title}</h3>
        <p className="m-0 mt-0.5 text-label text-text-tertiary">{side === 'entry' ? 'When your strategy should enter a position' : 'When your strategy should exit'}</p>
      </div>
      <div className="flex items-center gap-2 text-label text-text-tertiary">
        Check {timingSlot ?? <FieldAtom kind="timing" label="On candle close" />}
      </div>
      <div className="relative flex flex-col pl-[6px]">
        <span aria-hidden="true" className="size-3 -translate-x-[6px] rounded-full border border-line-node bg-surface" />
        <div className="relative pt-2.5 pb-1">
          <span aria-hidden="true" className="absolute top-0 bottom-3.5 left-0 w-px bg-line-connector" />
          {rows.length >= 2 && (
            <div className="mb-2.5 pl-4">
              {logicSlot ?? <FieldAtom kind="logic" label={word} />}
            </div>
          )}
          {rows.length > 0 ? (
            <div className="pl-[10px]">
              <Rail insertAt={insertAt}>{rows}</Rail>
            </div>
          ) : (
            <div className="flex items-center gap-0 pl-0 pt-1">
              <span aria-hidden="true" className="h-px w-4 bg-line-connector" />
              {editor && <KitButton variant="primary" onClick={onAdd}>+ Add {title} Condition</KitButton>}
            </div>
          )}
          {drop === 'valid' && (
            <div className="mt-2.5 ml-[32px] flex h-9 items-center rounded-block border border-dashed border-brand bg-surface px-3 text-label font-medium text-brand-text">
              Drop here to add it to {title}
            </div>
          )}
        </div>
        {rows.length > 0 && editor && (
          <span className="-translate-x-[14px]">
            <RailAddButton label={`Add ${title.toLowerCase()} condition`} onClick={onAdd} />
          </span>
        )}
      </div>
    </section>
  );
}

/* ── Selection bar and toast (white, same surface as popovers — no dark bars) ── */

export interface SelectionBarProps {
  count: number;
  onGroup?: (w: LogicWord) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClear?: () => void;
  /** grouping would go past 2 levels */
  groupBlocked?: string;
}

export function SelectionBar({ count, onGroup, onDuplicate, onDelete, onClear, groupBlocked }: SelectionBarProps) {
  const canGroup = count >= 2 && !groupBlocked;
  return (
    <div role="toolbar" aria-label="Selection" className="inline-flex items-center gap-1 rounded-block border border-border-control bg-surface py-1.5 pr-1.5 pl-3 text-body whitespace-nowrap shadow-surface">
      <span className="font-medium">{count} selected</span>
      <span className="mx-1.5 h-4 w-px bg-border-control" />
      <span className="mr-1 text-hint text-text-tertiary">Group as</span>
      {(['All of', 'Any of', 'None of'] as const).map((w) => (
        <KitButton key={w} variant="secondary" disabled={!canGroup} onClick={() => onGroup?.(w)}>{w}</KitButton>
      ))}
      {!canGroup && <span className="ml-1 text-hint text-text-subtle">{groupBlocked ?? 'Tick one more to group'}</span>}
      <span className="mx-1.5 h-4 w-px bg-border-control" />
      <KitButton variant="tertiary" onClick={onDuplicate}>Duplicate</KitButton>
      <KitButton variant="destructive" onClick={onDelete}>Delete</KitButton>
      <button type="button" aria-label="Clear selection" onClick={onClear} className="flex size-7 items-center justify-center rounded-chip text-text-tertiary hover:bg-surface-selected">✕</button>
    </div>
  );
}

/** Toast: [✦ for Copilot · </> after your own Run] + text + Undo as a secondary button (FIXES.md 7). */
export function CanvasToast({ text, onUndo, icon }: { text: string; onUndo?: () => void; icon?: 'ai' | 'code' }) {
  return (
    <div role="status" className="inline-flex items-center gap-3 rounded-block border border-border-control bg-surface py-1.5 pr-1.5 pl-3 text-body whitespace-nowrap shadow-surface">
      {icon === 'ai' && (
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" className="-mr-1 shrink-0 fill-ai">
          <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
        </svg>
      )}
      {icon === 'code' && <span aria-hidden="true" className="-mr-1 font-mono text-[11px] font-semibold text-text-secondary">&lt;/&gt;</span>}
      {text}
      {onUndo !== undefined && <KitButton variant="secondary" className="!h-7 !px-3 font-medium" onClick={onUndo}>Undo</KitButton>}
    </div>
  );
}
