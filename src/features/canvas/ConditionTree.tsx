import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Fragment } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { logicName } from '@/lib/conditions';
import { useCanvas } from '@/store/canvas';
import type { Group, Side } from '@/types/strategy';
import { ConditionBlock } from './ConditionBlock';
import { GroupMenu, LogicMenu } from './menus';
import { SelectCheck } from './SelectCheck';

/*
  How conditions hang together (B07, B08):
    [AND] ── │── condition
             │── condition
             │── ┌ ANY OF ▾ ─────────────┐
                 │ [OR] ── │── condition  │
                 │         │── condition  │
                 └────────────────────────┘
  The AND/OR button only appears once there are two or more things to join.
  While dragging, thin drop spots between rows open up as "Drop here" (E09).
*/

/** Data every drop target carries: where the dragged block would land. */
export interface DropTarget {
  parentId: string;
  index: number;
}

export function GroupChildren({ group, side, root, insideDragged }: { group: Group; side: Side; root?: boolean; insideDragged?: boolean }) {
  const { active } = useDndContext();
  const dragging = !!active;
  const lockDrops = insideDragged || active?.id === group.id;
  const many = group.children.length >= 2;

  const rows = (
    <div className={`flex flex-col ${many ? 'border-l border-line-connector' : ''}`}>
      {group.children.map((ch, i) => (
        <Fragment key={ch.id}>
          <DropSlot parentId={group.id} index={i} edge={i === 0} disabled={lockDrops} />
          <div data-flip={ch.id} className="flex items-center">
            {many && <span className="h-px w-[22px] shrink-0 bg-line-connector" />}
            {ch.kind === 'cond' ? (
              <ConditionBlock cond={ch} parentId={group.id} />
            ) : (
              <GroupBox group={ch} side={side} parentId={group.id} insideDragged={lockDrops || active?.id === ch.id} />
            )}
          </div>
        </Fragment>
      ))}
      {(dragging || group.children.length === 0) && <DropSlot parentId={group.id} index={group.children.length} edge disabled={lockDrops} />}
    </div>
  );

  if (!many) return rows;
  return (
    <div className="flex items-center">
      <span data-flip={`logic:${group.id}`} className="flex">
        <LogicButton group={group} />
      </span>
      <span className={`h-px shrink-0 bg-line-connector ${root ? 'w-[44px]' : 'w-[28px]'}`} />
      {rows}
    </div>
  );
}

/** AND / OR on the line (B07). Picking one changes how this level joins. */
function LogicButton({ group }: { group: Group }) {
  const editor = useCanvas((s) => s.editor);
  const selected = useCanvas((s) => s.selected);
  const { openEditor, closeEditor, setLogic, group: groupAs } = useCanvas.getState();
  const open = editor?.id === group.id && editor.part === 'logic';
  return (
    <Popover floating
      open={open}
      onClose={closeEditor}
      trigger={
        <button
          type="button"
          aria-label={`Conditions joined with ${group.logic}. Change`}
          onClick={() => (open ? closeEditor() : openEditor(group.id, 'logic'))}
          className={`h-7 shrink-0 rounded-chip bg-surface px-3.5 text-[11px] font-semibold text-text-control ${open ? 'border-[1.5px] border-brand' : 'border border-border-chip hover:border-border-strong'}`}
        >
          {group.logic}
        </button>
      }
    >
      <LogicMenu
        value={group.logic}
        selectedCount={selected.length}
        onPick={(l) => setLogic(group.id, l)}
        onGroup={() => groupAs(selected, group.logic === 'AND' ? 'OR' : 'AND')}
      />
    </Popover>
  );
}

/** A dashed ANY OF / ALL OF box (B08, E07). Its label opens the group menu (E08). */
function GroupBox({ group, side, parentId, insideDragged }: { group: Group; side: Side; parentId: string; insideDragged?: boolean }) {
  const editor = useCanvas((s) => s.editor);
  const selected = useCanvas((s) => s.selected.includes(group.id));
  const { openEditor, closeEditor, setLogic, addCondition, ungroup, remove, selectOnly, toggleSelect } = useCanvas.getState();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: group.id });
  const { over, active } = useDndContext();
  const { setNodeRef: setBoxRef } = useDroppable({ id: `box:${group.id}`, data: { parentId: group.id, index: group.children.length } satisfies DropTarget, disabled: insideDragged || !active });
  const target = !insideDragged && (over?.data.current as DropTarget | undefined)?.parentId === group.id;
  const open = editor?.id === group.id && editor.part === 'groupMenu';

  return (
    <div ref={setNodeRef} className={`group/box relative ${isDragging ? 'opacity-40' : ''}`}>
      <button
        type="button"
        aria-label="Drag group"
        {...attributes}
        {...listeners}
        className="absolute top-1 -left-[20px] flex h-7 w-4 cursor-grab items-center justify-center text-[14px] tracking-[-2px] text-text-subtle opacity-0 group-hover/box:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <div
        ref={setBoxRef}
        data-group-box={group.id}
        // a click on the box itself (its padding), not on a block inside, selects the whole group
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest('[data-group-box]')?.getAttribute('data-group-box') !== group.id || t.closest('button,[data-condition]')) return;
          if (e.shiftKey) toggleSelect(group.id);
          else selectOnly([group.id]);
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest('[data-group-box]')?.getAttribute('data-group-box') === group.id && !t.closest('button,[data-condition]')) listeners?.onPointerDown?.(e);
        }}
        className={`relative rounded-dialog pt-5 pr-4 pb-3.5 pl-3 transition-[border-color,background-color,box-shadow] duration-150 ${
          target
            ? 'border-[1.5px] border-dashed border-brand bg-drop-tint'
            : selected
              ? 'border-[1.5px] border-solid border-brand bg-surface-group shadow-focus'
              : 'border border-dashed border-border-group bg-surface-group hover:border-border-strong'
        }`}
      >
        <div className="absolute -top-[11px] left-3 flex items-center gap-1 rounded-chip bg-surface-group">
          <SelectCheck id={group.id} parentId={parentId} label={`${logicName(group.logic)} group`} scope="box" />
          <Popover floating
            open={open}
            onClose={closeEditor}
            trigger={
              <button
                type="button"
                onClick={() => (open ? closeEditor() : openEditor(group.id, 'groupMenu'))}
                className={`flex h-[22px] items-center gap-1 rounded-chip border bg-surface px-2 text-[10.5px] font-semibold ${
                  target ? 'border-brand-border text-brand-text' : open ? 'border-brand text-text-secondary' : 'border-border-chip text-text-secondary hover:border-border-strong'
                }`}
              >
                {logicName(group.logic)}
                {target ? ' · DROP TO ADD' : <ChevronDownIcon size={10} />}
              </button>
            }
          >
            <GroupMenu
              logic={group.logic}
              onSwitch={() => setLogic(group.id, group.logic === 'OR' ? 'AND' : 'OR')}
              onAdd={() => addCondition(side, group.id)}
              onUngroup={() => ungroup(group.id)}
              onDelete={() => remove([group.id])}
            />
          </Popover>
        </div>
        <GroupChildren group={group} side={side} insideDragged={insideDragged} />
      </div>
    </div>
  );
}

/** The gap between two rows. Glides open into "Drop here" when a dragged block hovers it. */
function DropSlot({ parentId, index, edge, disabled }: DropTarget & { edge?: boolean; disabled?: boolean }) {
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${parentId}:${index}`, data: { parentId, index } satisfies DropTarget, disabled: disabled || !active });
  // edges collapse when nothing is being dragged, so the tree stays tight
  const height = isOver ? 54 : active || !edge ? 14 : 0;
  return (
    <div ref={setNodeRef} style={{ height }} className="relative transition-[height] duration-200 ease-[cubic-bezier(0.2,0,0,1)]">
      <div className={`absolute inset-y-[7px] left-0 flex items-center transition-opacity duration-150 ${isOver ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <span className="h-px w-[22px] shrink-0 bg-line-connector" />
        <div className="flex h-10 w-[330px] items-center justify-center rounded-block border-[1.5px] border-dashed border-brand bg-drop-tint text-chip font-medium text-brand-text">
          Drop here
        </div>
      </div>
    </div>
  );
}
