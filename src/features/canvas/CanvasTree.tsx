import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { useContext, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Popover } from '@/components/ui/Popover';
import { findNode, heightOf, isInside, levelOf, MAX_DEPTH } from '@/lib/conditions';
import { operandLabel, mathLabel } from '@/lib/indicators';
import { useCanvas, useSelectionParent } from '@/store/canvas';
import type { Group, Side, StrategyNode } from '@/types/strategy';
import { CanvasBlock } from './CanvasBlock';
import { FieldAtom, MathChip } from './kit/atoms';
import { ConditionBlock, type Joinable } from './kit/ConditionBlock';
import { DragHandle, MoreButton } from './kit/controls';
import { GroupMenu, LogicMenu } from './kit/menus';
import { LogicGroup } from './kit/tree';
import { useDragState } from './dragState';
import { ChangedContext, LOGIC_OF, WORD } from './shared';

/*
  The condition tree on the real canvas: rows on a rail, groups as dashed boxes
  with one logic node (All of / Any of / None of). Built from kit parts.
  Each row is also a drop zone: the top half inserts above it, the bottom half below.
*/

/** One row of a group: give it `key={node.id}` (the rail uses keys for smart animate). */
export function TreeRow({ node, parentId, index, side }: { node: StrategyNode; parentId: string; index: number; side: Side }) {
  return (
    <Row node={node} parentId={parentId} index={index}>
      {node.kind === 'cond' ? <CondRow id={node.id} parentId={parentId} /> : <CanvasGroup group={node} side={side} parentId={parentId} />}
    </Row>
  );
}

/** A drop zone around one row. Disabled inside the thing being dragged. */
function Row({ node, parentId, index, children }: { node: StrategyNode; parentId: string; index: number; children: ReactNode }) {
  const { active } = useDndContext();
  const inDragged = useCanvas((s) => !!active && isInside({ entry: s.entry, exit: s.exit }, node.id, String(active.id)));
  const { setNodeRef } = useDroppable({ id: `row:${node.id}`, data: { parentId, index }, disabled: !active || inDragged });
  return <div ref={setNodeRef}>{children}</div>;
}

function CondRow({ id, parentId }: { id: string; parentId: string }) {
  const cond = useCanvas((s) => findNode(s.entry, id) ?? findNode(s.exit, id));
  const joinable = useJoinable(id, parentId);
  const changed = useContext(ChangedContext).has(id);
  if (!cond || cond.kind !== 'cond') return null;
  return <CanvasBlock cond={cond} joinable={joinable.joinable} changed={changed} />;
}

/**
 * While some are ticked: siblings (same box) can join; everything else dims (§8).
 * A box that holds the selection, or sits inside a ticked box, stays as it is.
 * A sibling box that would end up 3 levels deep stays dimmed, with the reason.
 */
function useJoinable(id: string, parentId: string): { joinable: Joinable; reason?: string } {
  const selParent = useSelectionParent();
  return useCanvas(useShallow((s) => {
    if (!s.selected.length || s.selected.includes(id)) return { joinable: 'none' as Joinable };
    const t = { entry: s.entry, exit: s.exit };
    const node = findNode(t.entry, id) ?? findNode(t.exit, id);
    if (!node) return { joinable: 'none' as Joinable };
    if (parentId === selParent) {
      if (node.kind === 'group' && levelOf(t, parentId) + 1 + heightOf(node) > MAX_DEPTH)
        return { joinable: 'cantJoin' as Joinable, reason: "Groups go 2 levels deep. This group can't go inside another." };
      return { joinable: 'canJoin' as Joinable };
    }
    if (node.kind === 'group' && s.selected.some((x) => findNode(node, x))) return { joinable: 'none' as Joinable };
    if (s.selected.some((x) => { const n = findNode(t.entry, x) ?? findNode(t.exit, x); return n?.kind === 'group' && !!findNode(n, id); }))
      return { joinable: 'none' as Joinable };
    return { joinable: 'cantJoin' as Joinable };
  }));
}

/* ── Group ─────────────────────────────────────────────────────── */

function CanvasGroup({ group, side, parentId }: { group: Group; side: Side; parentId: string }) {
  const editor = useCanvas((s) => s.editor);
  const selected = useCanvas((s) => s.selected.includes(group.id));
  const { openEditor, closeEditor, setLogic, addCondition, duplicate, ungroup, remove, toggleSelect } = useCanvas.getState();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: group.id });
  const target = useDragState((s) => (s.target?.parentId === group.id ? s.target : null));
  const { joinable, reason } = useJoinable(group.id, parentId);
  const mine = editor?.id === group.id ? editor.part : null;
  const word = WORD[group.logic];

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-50' : ''}>
      <LogicGroup
        nodeId={group.id}
        word={word}
        selected={selected}
        joinable={joinable}
        cantJoinReason={reason}
        drop={target ? (target.valid ? 'valid' : 'invalid') : 'none'}
        dropReason={target?.reason}
        insertAt={target?.valid ? target.index : undefined}
        keepControls={mine === 'more'}
        onToggleSelect={() => toggleSelect(group.id)}
        // the logic menu only switches the logic; group actions are in ⋯
        nodeSlot={
          <Popover floating open={mine === 'logic'} onClose={closeEditor} trigger={
            <FieldAtom kind="logic" label={word} open={mine === 'logic'} onClick={() => (mine === 'logic' ? closeEditor() : openEditor(group.id, 'logic'))} />
          }>
            <LogicMenu current={word} onPick={(w) => setLogic(group.id, LOGIC_OF[w])} />
          </Popover>
        }
        moreSlot={
          <Popover floating align="right" open={mine === 'more'} onClose={closeEditor} trigger={
            <MoreButton label="Group actions" open={mine === 'more'} onClick={() => (mine === 'more' ? closeEditor() : openEditor(group.id, 'more'))} />
          }>
            <GroupMenu
              onAdd={() => addCondition(side, group.id)}
              onDuplicate={() => duplicate([group.id])}
              onUngroup={() => ungroup(group.id)}
              onDelete={() => remove([group.id])}
            />
          </Popover>
        }
        handleSlot={<span {...attributes} {...listeners}><DragHandle label="Drag group" dragging={isDragging} /></span>}
      >
        {group.children.map((ch, i) => <TreeRow key={ch.id} node={ch} parentId={group.id} index={i} side={side} />)}
      </LogicGroup>
    </div>
  );
}

/* ── The moving copy while dragging (no menus, no handlers) ────── */

export function DragCopy({ id }: { id: string }) {
  const node = useCanvas((s) => findNode(s.entry, id) ?? findNode(s.exit, id));
  if (!node) return null;
  return <StaticNode node={node} dragging />;
}

/* ── Copilot placing blocks (design/copilot · Canvas states) ───── */

/** Rows Copilot has queued (skeleton), is placing (ghost) or is waiting on (placeholder). */
export function CopilotPreviewRows({ side }: { side: Side }) {
  const preview = useCanvas((s) => (s.copilotPreview?.side === side || s.copilotPreview?.placeholder === side ? s.copilotPreview : null));
  if (!preview) return [];
  const rows = preview.side === side
    ? preview.rows.map((r, i) =>
        r.kind === 'skeleton'
          ? <div key={`sk${i}`} aria-label="Queued by Copilot" className="h-10 w-[300px] animate-pulse rounded-block border border-dashed border-ai-border bg-ai-tint" />
          : <div key={`gh${i}`}><StaticNode node={r.cond} ghost /></div>,
      )
    : [];
  if (preview.placeholder === side && preview.side !== side)
    rows.push(
      <div key="wait" className="flex h-10 w-[300px] items-center rounded-block border border-dashed border-ai-border px-3 text-label text-ai-text">
        Waiting for your answer in Copilot
      </div>,
    );
  return rows;
}

function StaticNode({ node, dragging = false, ghost = false }: { node: StrategyNode; dragging?: boolean; ghost?: boolean }) {
  if (node.kind === 'group')
    return (
      <LogicGroup word={WORD[node.logic]} dragging={dragging}>
        {node.children.map((c) => <StaticNode key={c.id} node={c} />)}
      </LogicGroup>
    );
  const side = (o: typeof node.left, empty: string) => {
    if (!o) return <FieldAtom kind="operand" semantic="empty" label={empty} />;
    const { name, args } = operandLabel(o);
    return (
      <>
        <FieldAtom kind={o.type === 'number' ? 'value' : 'operand'} label={name} detail={args || undefined} />
        {o.math && <MathChip>{mathLabel(o.math)}</MathChip>}
      </>
    );
  };
  return (
    <ConditionBlock dragging={dragging} look={ghost ? 'ghost' : node.copilot ? 'copilot' : 'normal'} label="Condition">
      {side(node.left, 'Indicator')}
      <FieldAtom kind="relation" semantic={node.relation ? 'normal' : 'empty'} label={node.relation ?? 'Relation'} />
      {side(node.right, 'Indicator or value')}
    </ConditionBlock>
  );
}
