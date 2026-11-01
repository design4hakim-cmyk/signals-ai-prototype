import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { describeCondition, findNode, findParent, flatConditions, logicName } from '@/lib/conditions';
import { useCanvas } from '@/store/canvas';
import type { Group, Side, StrategyNode } from '@/types/strategy';
import { GroupChildren, type DropTarget } from './ConditionTree';
import { useSmartAnimate } from './useSmartAnimate';
import { MAX_ZOOM, MIN_ZOOM, useViewport } from './useViewport';

/*
  The canvas (B02–B08, E01–E09), with a Figma-style camera:
    • Entry and Exit are FRAMES. Click a frame's title to select it, drag the
      title (or use the arrow keys) to move it anywhere.
    • Click a block or a box's edge to select it; shift-click adds; drag on empty
      canvas draws a selection box. Drag a selected thing, or press ↑ / ↓, to move
      it up and down — the rest of the tree slides into place (smart animate).
    • Zoom and pan: see useViewport. Zoom controls sit bottom-right.
  Moving frames and the camera is layout only: it never pauses the chart.
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

/** Exit sits to the right of Entry until someone moves it. */
const EXIT_GAP = 72;
const MIN_ENTRY_WIDTH = 560;

interface Marquee {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function StrategyCanvas() {
  const entry = useCanvas((s) => s.entry);
  const exit = useCanvas((s) => s.exit);
  const selected = useCanvas((s) => s.selected);
  const toast = useCanvas((s) => s.toast);
  const view = useCanvas((s) => s.view);
  const { move } = useCanvas.getState();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const cam = useViewport(viewportRef, worldRef);

  useCanvasShortcuts();
  useSmartAnimate(worldRef);

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

  // Empty canvas: Space/middle-drag pans, a plain drag draws a selection box, a click clears
  const onPointerDown = (e: ReactPointerEvent) => {
    if (cam.spaceDown || e.button === 1) return cam.startPan(e);
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,[data-condition],[data-group-box],[data-frame-header],input,[data-menu]')) return;
    e.preventDefault();
    const vp = viewportRef.current!.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const box = { left: Math.min(start.x, ev.clientX), top: Math.min(start.y, ev.clientY), right: Math.max(start.x, ev.clientX), bottom: Math.max(start.y, ev.clientY) };
      if (!moved && box.right - box.left < 4 && box.bottom - box.top < 4) return;
      moved = true;
      setMarquee({ x: box.left - vp.left, y: box.top - vp.top, w: box.right - box.left, h: box.bottom - box.top });
      // every block the box touches, on the side of the first one hit
      const hits = [...worldRef.current!.querySelectorAll<HTMLElement>('[data-condition]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;
      });
      // only blocks in the same box as the first one hit, so the selection can be grouped
      const { entry: en, exit: ex } = useCanvas.getState();
      const parentOf = (id: string) => (findParent(en, id) ?? findParent(ex, id))?.id;
      const all = hits.map((el) => el.dataset.condition!);
      const ids = all.filter((id) => parentOf(id) === parentOf(all[0]));
      const cur = useCanvas.getState().selected;
      if (ids.length !== cur.length || ids.some((id, i) => id !== cur[i])) useCanvas.getState().selectOnly(ids);
    };
    const onUp = () => {
      if (!moved) useCanvas.getState().clearSelection();
      setMarquee(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // dots move and scale with the camera, like Figma's canvas grid
  const dot = 16 * view.zoom;

  return (
    <section aria-label="Strategy canvas" className="relative min-h-0 grow overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={smallestUnderPointer}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        autoScroll={false}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setDragId(null); setOverTarget(null); }}
      >
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          className="bg-canvas-dots absolute inset-0 overflow-hidden select-none"
          style={{
            backgroundSize: `${dot}px ${dot}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
            cursor: cam.panning ? 'grabbing' : cam.spaceDown ? 'grab' : undefined,
          }}
        >
          <div
            ref={worldRef}
            className={`absolute top-0 left-0 origin-top-left ${cam.spaceDown ? 'pointer-events-none' : ''}`}
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              transition: cam.gliding ? 'transform 240ms cubic-bezier(0.2, 0, 0, 1)' : 'none',
            }}
          >
            <Frames entry={entry} exit={exit} />
          </div>

          {marquee && (
            <div className="pointer-events-none absolute border border-brand bg-drop-tint" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}

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
            // drawn at the canvas zoom, so it looks like the thing you picked up
            <div className="origin-top-left" style={{ transform: `scale(${view.zoom})` }}>
              <div className="inline-flex items-center gap-2.5 rounded-block border-[1.5px] border-border-strong bg-surface px-3.5 py-2 text-body font-medium whitespace-nowrap shadow-drag">
                <span className="text-[14px] tracking-[-2px] text-text-subtle">⋮⋮</span>
                {dragged.kind === 'cond' ? describeCondition(dragged, ' · ') : nodeWords(dragged)}
                <span className="text-hint font-normal text-text-subtle">moving…</span>
              </div>
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
        {selected.length > 1 && !dragged && <SelectionBar ids={selected} />}
        {selected.length === 1 && !dragged && !toast && (
          <span className="rounded-pill border border-border-control bg-surface px-3 py-1 text-hint text-text-tertiary shadow-popover">
            Tick more boxes to group them · Drag or ↑ ↓ to move · ⌫ delete
          </span>
        )}
      </div>

      <ZoomControls zoom={view.zoom} onStep={cam.step} onFit={cam.fit} onReset={() => cam.zoomTo(1, undefined, true)} />
    </section>
  );
}

/** Entry and Exit frames, each at its own spot on the canvas. */
function Frames({ entry, exit }: { entry: Group; exit: Group }) {
  const frames = useCanvas((s) => s.frames);
  const entryRef = useRef<HTMLDivElement>(null);
  const [entryWidth, setEntryWidth] = useState(MIN_ENTRY_WIDTH);

  useLayoutEffect(() => {
    const el = entryRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setEntryWidth(Math.max(MIN_ENTRY_WIDTH, el.offsetWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const exitPos = frames.exit ?? { x: frames.entry.x + entryWidth + EXIT_GAP, y: frames.entry.y };
  return (
    <>
      <Frame ref={entryRef} side="entry" root={entry} pos={frames.entry} title="Entry" hint="When your strategy should enter a position" />
      <Frame side="exit" root={exit} pos={exitPos} title="Exit" hint="When your strategy should exit" />
    </>
  );
}

function Frame({ side, root, pos, title, hint, ref }: { side: Side; root: Group; pos: { x: number; y: number }; title: string; hint: string; ref?: Ref<HTMLDivElement> }) {
  const { addCondition, selectFrame, moveFrame } = useCanvas.getState();
  const isSelected = useCanvas((s) => s.selectedFrame === side);
  const [moving, setMoving] = useState(false);
  const hasRows = root.children.length > 0;

  // Drag the title to move the whole tree (Figma: drag a frame by its name)
  const onHeaderDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectFrame(side);
    const zoom = useCanvas.getState().view.zoom;
    const start = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    const onMove = (ev: PointerEvent) => {
      setMoving(true);
      moveFrame(side, { x: Math.round(start.x + (ev.clientX - start.px) / zoom), y: Math.round(start.y + (ev.clientY - start.py) / zoom) });
    };
    const onUp = () => {
      setMoving(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={ref}
      data-frame={side}
      className={`group/frame absolute w-max rounded-card p-4 transition-shadow ${
        isSelected ? 'outline-[1.5px] outline-brand outline-solid' : 'outline-1 outline-transparent outline-solid'
      } ${moving ? 'shadow-drag' : ''}`}
      style={{ left: pos.x - 16, top: pos.y - 16 }}
    >
      <div
        data-frame-header
        onPointerDown={onHeaderDown}
        title={`Drag to move ${title}. Click to select.`}
        className={`group/head -m-1.5 w-max cursor-grab rounded-control p-1.5 transition-colors active:cursor-grabbing ${
          isSelected ? 'bg-brand-tint' : 'hover:bg-surface-hover hover:outline-1 hover:outline-brand-border hover:outline-solid'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {/* Always-visible grip: says "this whole tree can be dragged" */}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className={isSelected ? 'text-brand' : 'text-text-subtle group-hover/head:text-text-secondary'}>
            {[6, 12, 18].flatMap((y) => [9, 15].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="currentColor" />))}
          </svg>
          <h2 className={`m-0 text-title font-semibold ${isSelected ? 'text-brand-text' : ''}`}>{title}</h2>
          <span className={`ml-1 text-hint text-text-subtle transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/head:opacity-100'}`}>
            Drag to move
          </span>
        </span>
        <p className="m-0 mt-1 pl-5 text-label text-text-muted">{hint}</p>
      </div>
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

/** Bottom-right: − 100% + and Fit, like Figma's zoom menu. */
function ZoomControls({ zoom, onStep, onFit, onReset }: { zoom: number; onStep: (d: 1 | -1) => void; onFit: () => void; onReset: () => void }) {
  const btn = 'flex h-7 min-w-7 items-center justify-center rounded-chip px-1.5 text-body text-text-secondary hover:bg-surface-hover disabled:text-text-disabled disabled:hover:bg-transparent';
  return (
    <div role="toolbar" aria-label="Zoom" className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-control border border-border-control bg-surface p-0.5 shadow-popover">
      <button type="button" aria-label="Zoom out" title="Zoom out · ⌘−" disabled={zoom <= MIN_ZOOM} onClick={() => onStep(-1)} className={btn}>−</button>
      <button type="button" title="Back to 100% · ⇧0" onClick={onReset} className={`${btn} w-12 text-label font-medium tabular-nums`}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="Zoom in" title="Zoom in · ⌘+" disabled={zoom >= MAX_ZOOM} onClick={() => onStep(1)} className={btn}>+</button>
      <span className="mx-0.5 h-4 w-px bg-border-control" />
      <button type="button" title="See everything · ⇧1" onClick={onFit} className={`${btn} text-label font-medium`}>
        Fit
      </button>
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

/** ⌘Z undo · ⌫ delete · ⌘D duplicate · ↑↓ move · arrows nudge a frame · Esc clears. Ignored while typing. */
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
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && c.selected.length === 1 && !mod) {
        // ↑ ↓ moves the selected block or box up and down the tree
        e.preventDefault();
        c.nudge(c.selected[0], e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key.startsWith('Arrow') && c.selectedFrame && !mod) {
        // arrows nudge a selected frame: 1px, or 10px with Shift (Figma)
        e.preventDefault();
        const el = document.querySelector<HTMLElement>(`[data-frame="${c.selectedFrame}"]`);
        if (!el) return;
        const d = e.shiftKey ? 10 : 1;
        const x = el.offsetLeft + 16 + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0);
        const y = el.offsetTop + 16 + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
        c.moveFrame(c.selectedFrame, { x, y });
      } else if (e.key === 'Escape' && (c.selected.length || c.selectedFrame) && !c.editor) {
        c.clearSelection();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
