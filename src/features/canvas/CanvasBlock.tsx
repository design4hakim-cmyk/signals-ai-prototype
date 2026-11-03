import { useDraggable } from '@dnd-kit/core';
import { useRef, useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import { describeCondition, isComplete } from '@/lib/conditions';
import { INDICATORS, fmtNum, indicatorDef, inputFields, mathLabel, operandLabel } from '@/lib/indicators';
import { useCanvas, type EditorPart } from '@/store/canvas';
import type { Condition, IndicatorParams, Operand } from '@/types/strategy';
import { FieldAtom, MathChip } from './kit/atoms';
import { ConditionBlock, type Joinable } from './kit/ConditionBlock';
import { DragHandle, MoreButton } from './kit/controls';
import { ArithmeticMenu, BlockMenu, IndicatorPicker, IndicatorSettings, RelationMenu, type SettingField } from './kit/menus';

/*
  A condition on the real canvas, built only from kit parts
  (design/canvas-builder/COMPONENTS.md §5, §8).
    • A new block walks left to right: Indicator → Relation → Indicator or value.
    • Click the NAME to switch the indicator, the grey SETTINGS to edit them.
    • +−× ÷ shows on hover / while editing; a set step shows as "× 1.5".
    • Leave it half built and the missing field turns red; Update chart waits.
    • Only the open field gets the selected ring; the block itself doesn't change.
*/

const OPTIONS = INDICATORS.map((d) => ({ id: d.id, name: d.name, short: d.short, category: d.category, fav: d.id === 'ema' || d.id === 'rsi' }));

export function CanvasBlock({ cond, joinable, changed }: { cond: Condition; joinable: Joinable; changed: boolean }) {
  const editor = useCanvas((s) => s.editor);
  const selected = useCanvas((s) => s.selected.includes(cond.id));
  const { toggleSelect, openEditor, closeEditor, duplicate, addBelow, copyAsText, remove } = useCanvas.getState();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cond.id });

  const mine = editor?.id === cond.id ? editor.part : null;
  const editing = mine !== null && mine !== 'more';
  const halfBuilt = !isComplete(cond) && !editing;

  return (
    <ConditionBlock
      nodeId={cond.id}
      blockRef={setNodeRef}
      label={describeCondition(cond)}
      look={isDragging ? 'dragSource' : halfBuilt ? 'error' : cond.copilot ? 'copilot' : 'normal'}
      error={halfBuilt ? 'Finish this condition to update the chart' : undefined}
      selected={selected}
      changed={changed}
      joinable={joinable}
      keepControls={mine === 'more'}
      onToggleSelect={() => toggleSelect(cond.id)}
      moreSlot={
        <Popover floating align="right" open={mine === 'more'} onClose={closeEditor} trigger={<MoreButton open={mine === 'more'} onClick={() => (mine === 'more' ? closeEditor() : openEditor(cond.id, 'more'))} />}>
          <BlockMenu
            onDuplicate={() => duplicate([cond.id])}
            onAddBelow={() => addBelow(cond.id)}
            onCopy={() => { copyAsText([cond.id]); closeEditor(); }}
            onDelete={() => remove([cond.id])}
          />
        </Popover>
      }
      // drag only by ⋮⋮ (§8)
      handleSlot={<span {...attributes} {...listeners}><DragHandle dragging={isDragging} /></span>}
    >
      <OperandField cond={cond} which="left" mine={mine} editing={editing} />
      <RelationField cond={cond} open={mine === 'relation'} editing={editing} />
      <OperandField cond={cond} which="right" mine={mine} editing={editing} />
    </ConditionBlock>
  );
}

/* ── Indicator / value field, with its settings and arithmetic ── */

function OperandField({ cond, which, mine, editing }: { cond: Condition; which: 'left' | 'right'; mine: EditorPart | null; editing: boolean }) {
  const { openEditor, closeEditor, setOperand, setMath } = useCanvas.getState();
  const o = cond[which];
  const settings: EditorPart = which === 'left' ? 'leftSettings' : 'rightSettings';
  const math: EditorPart = which === 'left' ? 'leftMath' : 'rightMath';
  const toggle = (part: EditorPart) => (mine === part ? closeEditor() : openEditor(cond.id, part));

  const picker = (
    <IndicatorPicker
      options={OPTIONS}
      current={o?.type === 'indicator' ? indicatorDef(o.id).short : undefined}
      onPick={(opt) => {
        const id = opt.id as Extract<Operand, { type: 'indicator' }>['id'];
        // switching keeps the arithmetic; settings reset to the new indicator's defaults
        setOperand(cond.id, which, { type: 'indicator', id, params: { ...indicatorDef(id).defaults } });
      }}
      valueDraft={o?.type === 'number' ? fmtNum(o.value) : undefined}
      onValue={which === 'right' ? (n) => setOperand(cond.id, which, { type: 'number', value: n }) : undefined}
    />
  );

  if (!o) {
    // dashed while you build it; red once you've clicked away (§8 "Half-built block")
    return (
      <Popover floating open={mine === which} onClose={closeEditor} trigger={
        <FieldAtom
          kind={which === 'right' ? 'value' : 'operand'}
          semantic={editing ? 'empty' : 'error'}
          label={!editing ? 'Pick indicator' : which === 'left' ? 'Indicator' : 'Indicator or value'}
          open={mine === which}
          onClick={() => toggle(which)}
        />
      }>
        {picker}
      </Popover>
    );
  }

  const { name, args } = operandLabel(o);
  return (
    <>
      <Popover floating open={mine === which} onClose={closeEditor} trigger={
        <FieldAtom
          kind={o.type === 'number' ? 'value' : 'operand'}
          label={name}
          detail={args || undefined}
          open={mine === which || mine === settings}
          onClick={() => toggle(which)}
          onDetailClick={o.type === 'indicator' && inputFields(o.id).length ? () => toggle(settings) : undefined}
        />
      }>
        {picker}
      </Popover>
      {mine === settings && o.type === 'indicator' && (
        <Popover floating open onClose={closeEditor} trigger={<span />}>
          <SettingsEditor cond={cond} which={which} operand={o} onClose={closeEditor} />
        </Popover>
      )}
      <Popover floating open={mine === math} onClose={closeEditor} trigger={
        o.math ? (
          <button type="button" onClick={() => toggle(math)} title="Edit maths" className="rounded-[5px]">
            <MathChip>{mathLabel(o.math)}</MathChip>
          </button>
        ) : editing || mine === math ? (
          <FieldAtom kind="arithmetic" open={mine === math} onClick={() => toggle(math)} />
        ) : (
          // shown on hover of the block (CSS), so the row doesn't jump while editing
          <span className="hidden group-hover/block:inline-flex">
            <FieldAtom kind="arithmetic" onClick={() => toggle(math)} />
          </span>
        )
      }>
        <ArithmeticMenu
          on={[name, args].filter(Boolean).join(' ')}
          op={o.math?.op ?? '×'}
          by={o.math ? fmtNum(o.math.value) : ''}
          onChange={(op, by) => setMath(cond.id, which, { op, value: by })}
          onRemove={o.math ? () => setMath(cond.id, which, null) : undefined}
        />
      </Popover>
    </>
  );
}

/** Settings apply as you type. The first change counts once; more typing refines it. */
function SettingsEditor({ cond, which, operand, onClose }: { cond: Condition; which: 'left' | 'right'; operand: Extract<Operand, { type: 'indicator' }>; onClose: () => void }) {
  const { setParams } = useCanvas.getState();
  const def = indicatorDef(operand.id);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputFields(operand.id).map((k) => [k, String(operand.params[k] ?? '')])),
  );
  const counted = useRef(false);
  const LABEL: Record<string, string> = { length: 'Length', source: 'Source', offset: 'Offset', mult: 'StdDev', band: 'Band', k: '%K length', d: 'Smoothing' };
  const OPTS: Record<string, string[]> = { source: ['Close', 'Open', 'High', 'Low', 'Volume'], band: ['Upper', 'Middle', 'Lower'] };
  const errorOf = (k: string, v: string) => {
    if (OPTS[k]) return undefined;
    const n = Number(v);
    if (v.trim() === '' || !Number.isFinite(n)) return 'Type a number';
    if (k !== 'offset' && n <= 0) return `${LABEL[k]} must be ${k === 'mult' ? 'more than 0' : '1 or more'}`;
    return undefined;
  };
  const fields: SettingField[] = inputFields(operand.id).map((k) => ({ key: k, label: LABEL[k], value: draft[k], options: OPTS[k], error: errorOf(k, draft[k]) }));

  return (
    <IndicatorSettings
      name={def.short}
      fields={fields}
      onClose={onClose}
      onChange={(k, v) => {
        const next = { ...draft, [k]: v };
        setDraft(next);
        if (errorOf(k, v)) return; // bad input: keep the last good value
        const params: IndicatorParams = { ...operand.params, [k]: OPTS[k] ? v : Number(v) };
        setParams(cond.id, which, params, !counted.current);
        counted.current = true;
      }}
    />
  );
}

/* ── Relation ──────────────────────────────────────────────────── */

function RelationField({ cond, open, editing }: { cond: Condition; open: boolean; editing: boolean }) {
  const { openEditor, closeEditor, setRelation } = useCanvas.getState();
  const missing = !cond.relation && !editing;
  return (
    <Popover floating open={open} onClose={closeEditor} trigger={
      <FieldAtom
        kind="relation"
        semantic={cond.relation ? 'normal' : missing ? 'error' : 'empty'}
        label={cond.relation ?? (missing ? 'Pick relation' : 'Relation')}
        open={open}
        onClick={() => (open ? closeEditor() : openEditor(cond.id, 'relation'))}
      />
    }>
      <RelationMenu current={cond.relation ?? undefined} onPick={(r) => setRelation(cond.id, r as Condition['relation'] & string)} />
    </Popover>
  );
}
