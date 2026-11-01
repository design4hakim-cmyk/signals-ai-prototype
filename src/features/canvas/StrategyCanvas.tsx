import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { describeCondition, findNode, flatConditions, logicName } from '@/lib/conditions';
import { useCanvas } from '@/store/canvas';
import type { Group, Side, StrategyNode } from '@/types/strategy';
import { GroupChildren, type DropTarget } from './ConditionTree';

/*
  The dotted canvas with Entry and Exit columns (B02–B08, E01–E09).
  Everything here is real and editable. Drag and drop uses dnd-kit:
  drag a block by its ⋮⋮ handle, drop it between rows or into a box.
*/

// The smallest drop target under the pointer wins, so a gap inside a box beats the box itself
const smallestUnderPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (!hits.length) return rectIntersection(args);
  const area = (id: string | number) => {
    const r = args.droppableRects.get(id);
    return r ? r.width * r.height : Infinity;
  };
  return [...hits].sort((a, b) => area(a.id) - area(b.id));
};

const nodeWords = (n: StrategyNode | null) => (!n ? '' : n.kind === 'cond' ? describeCondition(n) : `${logicName(n.logic)} group`);

export function StrategyCanvas() {
  const entry = useCanvas((s) => s.entry);
  const exit = useCanvas((s) => s.exit);
  const selected = useCanvas((s) => s.selected);
  const toast = useCanvas((s) => s.toast);
  const { move, clearSelection } = useCanvas.getState();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  useCanvasShortcuts();

  const find = (id: string) => findNode(entry, id) ?? findNode(exit, id);
  const dragged = dragId ? find(dragId) : null;
  const targetGroup = overTarget ? (find(overTarget.parentId) as Group | null) : null;
  const intoBox = targetGroup && targetGroup.id !== entry.id && targetGroup.id !== exit.id;
  const isEmpty = flatConditions(entry).length === 0 && flatConditions(exit).length === 0;

  const onDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    useCanvas.setState({ editor: null });
  };
  const onDragOver = (e: DragOverEvent) => setOverTarget((e.over?.data.current as DropTarget | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const t = e.over?.data.current as DropTarget | undefined;
    if (t) move(String(e.active.id), t.parentId, t.index);
    setDragId(null);
    setOverTarget(null);
  };

  return (
    <section aria-label="Strategy canvas" className="relative min-h-0 grow">
      <DndContext sensors={sensors} collisionDetection={smallestUnderPointer} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setDragId(null); setOverTarget(null); }}>
        <div
          className="bg-canvas-dots absolute inset-0 overflow-auto"
          // clicking empty canvas clears a selection
          onMouseDown={(e) => {
            if (selected.length && !(e.target as HTMLElement).closest('[data-condition],button,[role="dialog"],[role="menu"]')) clearSelection();
          }}
        >
          <div className="grid min-w-max grid-cols-[minmax(560px,1.6fr)_minmax(400px,1fr)] gap-8 px-12 pt-8 pb-28">
            <Column side="entry" root={entry} title="Entry" hint="When your strategy should enter a position" />
            <Column side="exit" root={exit} title="Exit" hint="When your strategy should exit" />
          </div>

          {isEmpty && !dragId && (
            <div className="pointer-events-none absolute top-[200px] left-1/2 flex w-[420px] -translate-x-1/2 flex-col items-center gap-2 text-center">
              <p className="m-0 text-body-lg font-medium text-text-secondary">Your strategy will appear here</p>
              <p className="m-0 text-chip text-text-muted">
                Describe it to Copilot, press + to add a condition, or open a saved one from My Strategies.
              </p>
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragged && (
            <div className="inline-flex items-center gap-2.5 rounded-block border-[1.5px] border-border-strong bg-surface px-3.5 py-2 text-body font-medium whitespace-nowrap shadow-drag">
              <span className="text-[14px] tracking-[-2px] text-text-subtle">⋮⋮</span>
              {dragged.kind === 'cond' ? describeCondition(dragged, ' · ') : nodeWords(dragged)}
              <span className="text-hint font-normal text-text-subtle">moving…</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Bottom of the canvas: what's happening right now */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {dragged && overTarget && (
          <div role="status" className="rounded-block bg-text-primary px-3.5 py-2 text-body text-text-on-brand shadow-toolbar">
            Moving {nodeWords(dragged)} {intoBox ? `into ${logicName(targetGroup!.logic)}` : 'here'}
          </div>
        )}
        {toast && !dragged && <CanvasToast text={toast.text} undo={toast.undo} />}
        {selected.length > 0 && !dragged && <SelectionBar ids={selected} />}
      </div>
    </section>
  );
}

function Column({ side, root, title, hint }: { side: Side; root: Group; title: string; hint: string }) {
  const { addCondition } = useCanvas.getState();
  const hasRows = root.children.length > 0;
  return (
    <div className="min-w-0">
      <h2 className="m-0 text-title font-semibold">{title}</h2>
      <p className="m-0 mt-1 text-label text-text-muted">{hint}</p>
      {side === 'entry' ? (
        <span className="mt-3 inline-flex h-6 items-center rounded-pill border border-border-control bg-surface px-2.5 text-hint text-text-secondary">On candle close</span>
      ) : (
        <span className="mt-3 block h-6" />
      )}
      <div className="mt-1.5 flex flex-col">
        <span className="size-3 rounded-full border border-line-node bg-surface" />
        <div className={`ml-1.5 flex items-center border-l border-line-connector ${hasRows ? 'py-4' : 'py-2.5'}`}>
          <span className="h-px w-[34px] shrink-0 bg-line-connector" />
          <GroupChildren group={root} side={side} root />
        </div>
        <button
          type="button"
          aria-label={`Add ${title.toLowerCase()} condition`}
          onClick={() => addCondition(side)}
          className="flex size-[22px] items-center justify-center rounded-full border border-brand bg-surface text-[14px] leading-none text-brand hover:bg-brand-tint"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Dark toast with Undo (E05, E07). */
function CanvasToast({ text, undo }: { text: string; undo: boolean }) {
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-block bg-text-primary py-[9px] pr-2.5 pl-3.5 text-body text-text-on-brand shadow-toolbar">
      {text}
      {undo && (
        <button type="button" onClick={() => useCanvas.getState().undo()} className="h-[26px] rounded-chip border border-text-secondary px-2.5 text-label text-text-on-brand hover:bg-toolbar-divider">
          Undo
        </button>
      )}
    </div>
  );
}

/** Appears once something is selected: group, duplicate, delete (E06). */
function SelectionBar({ ids }: { ids: string[] }) {
  const { group, duplicate, remove, clearSelection } = useCanvas.getState();
  const btn = 'h-[30px] rounded-chip px-2.5 text-chip text-text-on-brand hover:bg-toolbar-divider disabled:cursor-not-allowed disabled:text-toolbar-muted disabled:hover:bg-transparent';
  const canGroup = ids.length >= 2;
  return (
    <div role="toolbar" aria-label="Selection" className="pointer-events-auto flex items-center whitespace-nowrap gap-0.5 rounded-block bg-text-primary py-[5px] pr-1.5 pl-3.5 text-body text-text-on-brand shadow-toolbar">
      <span className="mr-2">{ids.length} selected</span>
      <span className="mx-1 h-[18px] w-px bg-toolbar-divider" />
      <span className="mx-1.5 text-hint text-toolbar-muted">Group as</span>
      {/* Board shows ANY OF filled blue; kept neutral so the page keeps one filled-blue button */}
      <button type="button" disabled={!canGroup} title={canGroup ? undefined : 'Select one more to group'} onClick={() => group(ids, 'OR')} className={`${btn} font-medium`}>
        ANY OF · OR
      </button>
      <button type="button" disabled={!canGroup} title={canGroup ? undefined : 'Select one more to group'} onClick={() => group(ids, 'AND')} className={`${btn} font-medium`}>
        ALL OF · AND
      </button>
      <span className="mx-1 h-[18px] w-px bg-toolbar-divider" />
      <button type="button" onClick={() => duplicate(ids)} className={btn}>Duplicate</button>
      <button type="button" onClick={() => remove(ids)} className={btn}>Delete</button>
      <button type="button" aria-label="Clear selection" onClick={clearSelection} className="flex size-[30px] items-center justify-center text-toolbar-muted hover:text-text-on-brand">
        ✕
      </button>
    </div>
  );
}

/** ⌘Z undo · ⌫ delete selected · ⌘D duplicate selected · Esc clears. Ignored while typing. */
function useCanvasShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select,[contenteditable="true"]')) return;
      const c = useCanvas.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (c.history.length) {
          e.preventDefault();
          c.undo();
        }
      } else if (mod && e.key.toLowerCase() === 'd' && c.selected.length) {
        e.preventDefault();
        c.duplicate(c.selected);
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && c.selected.length) {
        e.preventDefault();
        c.remove(c.selected);
      } else if (e.key === 'Escape' && c.selected.length && !c.editor) {
        c.clearSelection();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
