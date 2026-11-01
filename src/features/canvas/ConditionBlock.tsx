import { useDraggable } from '@dnd-kit/core';
import type { MouseEvent } from 'react';
import { Popover } from '@/components/ui/Popover';
import { mathLabel, operandLabel } from '@/lib/indicators';
import { useCanvas, type EditorPart } from '@/store/canvas';
import type { Condition } from '@/types/strategy';
import { IndicatorPicker, MathMenu, MoreMenu, RelationMenu, SettingsDialog } from './menus';

/*
  One condition block: Indicator 1 · Relation · Indicator 2.
  B02–B06: a new block walks you slot by slot.
  E01: hover shows ⋮⋮ (drag) and ⋯ (more) only.
  E02/E03: click the indicator NAME to switch it, its SETTINGS to edit them.
  Click the block's edge to select it, shift-click to add more (E06: checkbox +
  blue outline when several). Drag the block itself or its ⋮⋮ to move it.
  U02: a block left half-built shows dashed "Pick …" slots.
*/

export function ConditionBlock({ cond }: { cond: Condition }) {
  const editor = useCanvas((s) => s.editor);
  const selected = useCanvas((s) => s.selected.includes(cond.id));
  const several = useCanvas((s) => s.selected.length > 1);
  const { toggleSelect, selectOnly, closeEditor, openEditor, duplicate, remove, addBelow } = useCanvas.getState();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cond.id });

  const mine = editor?.id === cond.id ? editor.part : null;
  const building = mine !== null && mine !== 'more'; // walking through the slots right now

  // Shift-click anywhere toggles selection; a plain click on the block (not a slot) selects just it
  const onClickCapture = (e: MouseEvent) => {
    const onSlot = !!(e.target as HTMLElement).closest('button,[data-menu]');
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelect(cond.id);
    } else if (!onSlot) selectOnly([cond.id]);
  };

  const frame = selected
    ? 'border-brand bg-brand-tint shadow-focus'
    : building
      ? 'border-brand bg-surface shadow-focus'
      : 'border-border-control bg-surface group-hover/block:border-border-strong';

  return (
    <div ref={setNodeRef} className={`group/block relative flex items-center ${isDragging ? 'opacity-40' : ''}`}>
      <button
        type="button"
        aria-label="Drag condition"
        {...attributes}
        {...listeners}
        className="absolute -left-[20px] flex h-7 w-4 cursor-grab items-center justify-center text-[14px] tracking-[-2px] text-text-subtle opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <div
        onClickCapture={onClickCapture}
        onPointerDown={(e) => listeners?.onPointerDown?.(e)}
        data-condition={cond.id}
        className={`inline-flex cursor-default items-center gap-2.5 rounded-block border-[1.5px] py-1.5 pr-2 pl-3.5 whitespace-nowrap transition-[border-color,background-color,box-shadow] duration-150 ${frame}`}
      >
        {selected && several && (
          <span role="checkbox" aria-checked="true" aria-label="Selected" className="flex size-4 items-center justify-center rounded-[4px] bg-brand text-text-on-brand">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
        )}
        <OperandSlot cond={cond} which="left" mine={mine} building={building} />
        <RelationSlot cond={cond} open={mine === 'relation'} building={building} />
        <OperandSlot cond={cond} which="right" mine={mine} building={building} />
        <Popover floating
          open={mine === 'more'}
          onClose={closeEditor}
          align="right"
          trigger={
            <button
              type="button"
              data-menu
              aria-label="More actions"
              onClick={() => (mine === 'more' ? closeEditor() : openEditor(cond.id, 'more'))}
              className={`size-[26px] items-center justify-center rounded-[7px] border border-border-control bg-surface text-[15px] leading-none text-text-secondary hover:bg-surface-hover ${
                mine === 'more' ? 'flex' : 'hidden group-hover/block:flex'
              }`}
            >
              ⋯
            </button>
          }
        >
          <MoreMenu
            onDuplicate={() => duplicate([cond.id])}
            onSelect={() => toggleSelect(cond.id)}
            onAddBelow={() => addBelow(cond.id)}
            onDelete={() => remove([cond.id])}
          />
        </Popover>
      </div>
    </div>
  );
}

/* ── Indicator slot: name (switch) · settings (edit) · arithmetic ── */

function OperandSlot({ cond, which, mine, building }: { cond: Condition; which: 'left' | 'right'; mine: EditorPart | null; building: boolean }) {
  const { openEditor, closeEditor, setOperand, setMath, set } = useCanvas.getState();
  const o = cond[which];
  const settingsPart: EditorPart = which === 'left' ? 'leftSettings' : 'rightSettings';
  const mathPart: EditorPart = which === 'left' ? 'leftMath' : 'rightMath';
  const toggle = (part: EditorPart) => (mine === part ? closeEditor() : openEditor(cond.id, part));
  const active = 'bg-brand-soft outline outline-[1.5px] outline-brand';

  const picker = (
    <IndicatorPicker
      value={o}
      allowNumber={which === 'right'}
      onPick={(next) => setOperand(cond.id, which, next)}
    />
  );

  if (!o)
    return (
      <Popover floating open={mine === which} onClose={closeEditor} trigger={
        building || !cond.left ? (
          <button type="button" data-menu onClick={() => toggle(which)} className={`h-[38px] rounded-[9px] px-3 text-body-lg font-semibold text-text-control ${mine === which ? active : 'hover:bg-surface-hover'}`}>
            {which === 'left' ? 'Indicator 1' : 'Indicator 2'}
          </button>
        ) : (
          <button type="button" data-menu onClick={() => toggle(which)} className="h-[30px] rounded-[7px] border-[1.5px] border-dashed border-border-group bg-surface-hover px-3 text-body text-text-subtle hover:border-brand hover:text-brand">
            Pick indicator
          </button>
        )
      }>
        {picker}
      </Popover>
    );

  const { name, args } = operandLabel(o);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Popover floating open={mine === which} onClose={closeEditor} trigger={
        <span className="inline-flex items-center">
          <button
            type="button"
            data-menu
            title={o.type === 'number' ? 'Change value' : 'Switch indicator'}
            onClick={() => toggle(which)}
            className={`h-[30px] rounded-chip px-1 text-body font-medium text-text-primary ${mine === which ? active : 'hover:bg-surface-hover'}`}
          >
            {name}
          </button>
          {args && (
            <button
              type="button"
              data-menu
              title="Edit settings"
              onClick={() => toggle(settingsPart)}
              className={`h-[30px] rounded-chip px-1 text-body text-text-subtle ${mine === settingsPart ? active : 'hover:bg-surface-hover hover:text-text-secondary'}`}
            >
              {args}
            </button>
          )}
        </span>
      }>
        {picker}
      </Popover>
      {mine === settingsPart && o.type === 'indicator' && (
        <Popover floating open onClose={closeEditor} trigger={<span />}>
          <SettingsDialog
            operand={o}
            onClose={closeEditor}
            onSave={(params) => {
              if (JSON.stringify(params) === JSON.stringify(o.params)) return closeEditor();
              setOperand(cond.id, which, { ...o, params });
              set({ editor: null });
            }}
          />
        </Popover>
      )}
      <Popover floating open={mine === mathPart} onClose={closeEditor} trigger={
        o.math ? (
          <button type="button" data-menu title="Edit arithmetic" onClick={() => toggle(mathPart)} className="rounded-[5px] bg-brand-soft px-1.5 py-0.5 text-label font-semibold text-brand-text hover:outline hover:outline-1 hover:outline-brand-soft-border">
            {mathLabel(o.math)}
          </button>
        ) : (
          <button
            type="button"
            data-menu
            aria-label="Arithmetic operations"
            onClick={() => toggle(mathPart)}
            className={`grid-cols-2 gap-x-[5px] rounded-chip px-[5px] py-[3px] text-label leading-[11px] font-bold ${
              mine === mathPart
                ? 'grid bg-brand-soft text-brand'
                : building
                  ? 'grid text-text-secondary hover:bg-surface-hover'
                  : 'hidden text-text-secondary group-hover/block:grid hover:bg-surface-hover'
            }`}
          >
            <span>+</span><span>−</span><span>×</span><span>÷</span>
          </button>
        )
      }>
        <MathMenu current={o.math} onSet={(m) => setMath(cond.id, which, m)} />
      </Popover>
    </span>
  );
}

/* ── Relation slot ─────────────────────────────────────────────── */

function RelationSlot({ cond, open, building }: { cond: Condition; open: boolean; building: boolean }) {
  const { openEditor, closeEditor, setRelation } = useCanvas.getState();
  const toggle = () => (open ? closeEditor() : openEditor(cond.id, 'relation'));
  const trigger = cond.relation ? (
    <button type="button" data-menu onClick={toggle} className={`h-7 rounded-chip px-2.5 text-body font-medium text-text-primary ${open ? 'bg-brand-soft outline outline-[1.5px] outline-brand' : 'bg-surface-selected hover:bg-surface-chip'}`}>
      {cond.relation}
    </button>
  ) : building || !cond.left ? (
    <button type="button" data-menu onClick={toggle} className={`h-[34px] rounded-[9px] border bg-brand-soft px-3.5 text-[13.5px] font-semibold text-brand ${open ? 'border-brand' : 'border-brand-soft-border'}`}>
      Relation
    </button>
  ) : (
    <button type="button" data-menu onClick={toggle} className="h-[30px] rounded-[7px] border-[1.5px] border-dashed border-border-group bg-surface-hover px-3 text-body text-text-subtle hover:border-brand hover:text-brand">
      Pick relation
    </button>
  );
  return (
    <Popover floating open={open} onClose={closeEditor} trigger={trigger}>
      <RelationMenu value={cond.relation} onPick={(r) => setRelation(cond.id, r)} />
    </Popover>
  );
}
