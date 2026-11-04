import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { Popover } from '@/components/ui/Popover';
import { findNode, findParent, fitsIn, flatConditions, heightOf, isInside, levelOf, MAX_DEPTH, TOO_DEEP } from '@/lib/conditions';
import { useCanvas } from '@/store/canvas';
import type { Condition, Group, Side, StrategyTree } from '@/types/strategy';
import { useCopilot } from '@/store/copilot';
import { lineRanges } from '@/lib/pineParse';
import { usePine } from '@/store/pine';
import { CardAction, FitBadge, Secondary } from '@/features/copilot/parts';
import { CopilotPreviewRows, DragCopy, TreeRow } from './CanvasTree';
import { useDragState } from './dragState';
import { FieldAtom } from './kit/atoms';
import { LogicMenu, TimingMenu } from './kit/menus';
import { CanvasToast, SectionShell, SelectionBar } from './kit/tree';
import { ChangedContext, LOGIC_OF, WORD } from './shared';
import { useSmartAnimate } from './useSmartAnimate';
import { MAX_ZOOM, MIN_ZOOM, useViewport } from './useViewport';

/*
  The strategy canvas, built from the canvas builder kit (design/canvas-builder).
    • Entry and Exit are kit section shells, placed as frames you can move by their title.
    • Conditions, groups, menus and rings all come from src/features/canvas/kit.
    • Drag only by ⋮⋮; a blue line shows where it lands; too deep = dashed red + reason.
    • Tick blocks to group them (white selection bar); Delete has Undo for 8 seconds.
    • Zoom / pan like Figma (useViewport); tree changes glide (useSmartAnimate).
  Layout (camera, frame positions) never counts as a strategy change.
*/

// The smallest drop zone under the pointer wins, so a row inside a group beats the group's own row
const smallestUnderPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (!hits.length) return rectIntersection(args);
  const area = (id: string | number) => {
    const r = args.droppableRects.get(id);
    return r ? r.width * r.height : Infinity;
  };
  return [...hits].sort((a, b) => area(a.id) - area(b.id));
};

const EXIT_GAP = 72;
const MIN_ENTRY_WIDTH = 520;

interface Marquee { x: number; y: number; w: number; h: number }

/** Conditions that differ from the version the chart was last drawn with (the blue dot). */
function useChangedIds() {
  const entry = useCanvas((s) => s.entry);
  const exit = useCanvas((s) => s.exit);
  const applied = useCanvas((s) => s.applied);
  return useMemo(() => {
    const sig = (c: Condition) => JSON.stringify([c.left, c.relation, c.right]);
    const before = new Map([...flatConditions(applied.entry), ...flatConditions(applied.exit)].map((c) => [c.id, sig(c)]));
    return new Set([...flatConditions(entry), ...flatConditions(exit)].filter((c) => before.get(c.id) !== sig(c)).map((c) => c.id));
  }, [entry, exit, applied]);
}

const tree = (): StrategyTree => ({ entry: useCanvas.getState().entry, exit: useCanvas.getState().exit });

export function StrategyCanvas() {
  const entry = useCanvas((s) => s.entry);
  const exit = useCanvas((s) => s.exit);
  const selected = useCanvas((s) => s.selected);
  const toast = useCanvas((s) => s.toast);
  const codeOnly = useCanvas((s) => s.codeOnly);
  const view = useCanvas((s) => s.view);
  const activeId = useDragState((s) => s.activeId);
  const changed = useChangedIds();
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const cam = useViewport(viewportRef, worldRef);

  useCanvasShortcuts();
  useSmartAnimate(worldRef);

  const onDragStart = (e: DragStartEvent) => {
    useDragState.setState({ activeId: String(e.active.id), target: null });
    useCanvas.setState({ editor: null });
  };
  // Where would it land? Above or below the row under it, by the middle of the moving copy.
  const targetFor = (e: DragMoveEvent | DragEndEvent) => {
    const over = e.over;
    const data = over?.data.current as { parentId: string; index: number; append?: boolean } | undefined;
    if (!over || !data) return null;
    const moving = e.active.rect.current.translated;
    const below = !data.append && !!moving && moving.top + moving.height / 2 > over.rect.top + over.rect.height / 2;
    const t = tree();
    const node = findNode(t.entry, String(e.active.id)) ?? findNode(t.exit, String(e.active.id));
    const ok = !!node && fitsIn(t, node, data.parentId) && !isInside(t, data.parentId, node.id);
    return { parentId: data.parentId, index: data.index + (below ? 1 : 0), valid: ok, reason: ok ? undefined : TOO_DEEP };
  };
  const onDragMove = (e: DragMoveEvent) => {
    const next = targetFor(e);
    const cur = useDragState.getState().target;
    if (cur?.parentId !== next?.parentId || cur?.index !== next?.index || cur?.valid !== next?.valid) useDragState.setState({ target: next });
  };
  const onDragEnd = (e: DragEndEvent) => {
    // a very fast flick may end before a move was measured, so work it out again on release
    const target = targetFor(e) ?? useDragState.getState().target;
    if (target?.valid) useCanvas.getState().move(String(e.active.id), target.parentId, target.index);
    useDragState.setState({ activeId: null, target: null });
  };

  // Empty canvas: Space/middle-drag pans, a plain drag draws a selection box, a click clears
  const onPointerDown = (e: ReactPointerEvent) => {
    if (cam.spaceDown || e.button === 1) return cam.startPan(e);
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,[role="button"],[data-node-id],[data-frame-header],input,select,[data-menu]')) return;
    e.preventDefault();
    const vp = viewportRef.current!.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const box = { left: Math.min(start.x, ev.clientX), top: Math.min(start.y, ev.clientY), right: Math.max(start.x, ev.clientX), bottom: Math.max(start.y, ev.clientY) };
      if (!moved && box.right - box.left < 4 && box.bottom - box.top < 4) return;
      moved = true;
      setMarquee({ x: box.left - vp.left, y: box.top - vp.top, w: box.right - box.left, h: box.bottom - box.top });
      // blocks the box touches — only those in the same group as the first one, so they can be grouped
      const hits = [...worldRef.current!.querySelectorAll<HTMLElement>('[data-node-id]')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom; })
        .map((el) => el.dataset.nodeId!);
      const t = tree();
      const parent = (id: string) => (findParent(t.entry, id) ?? findParent(t.exit, id))?.id;
      const ids = hits.filter((id) => parent(id) === parent(hits[0]));
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

  const dot = 16 * view.zoom;
  const isEmpty = !codeOnly && !flatConditions(entry).length && !flatConditions(exit).length;

  return (
    <section aria-label="Strategy canvas" className="relative min-h-0 grow overflow-hidden">
      <ChangedContext.Provider value={changed}>
        <DndContext
          sensors={sensors}
          collisionDetection={smallestUnderPointer}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          autoScroll={false}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => useDragState.setState({ activeId: null, target: null })}
        >
          <div
            ref={viewportRef}
            onPointerDown={onPointerDown}
            className="bg-canvas-dots absolute inset-0 overflow-hidden select-none"
            style={{ backgroundSize: `${dot}px ${dot}px`, backgroundPosition: `${view.x}px ${view.y}px`, cursor: cam.panning ? 'grabbing' : cam.spaceDown ? 'grab' : undefined }}
          >
            <div
              ref={worldRef}
              className={`absolute top-0 left-0 origin-top-left ${cam.spaceDown ? 'pointer-events-none' : ''}`}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transition: cam.gliding ? 'transform 240ms cubic-bezier(0.2, 0, 0, 1)' : 'none' }}
            >
              {!codeOnly && <Frames entry={entry} exit={exit} />}
            </div>
            {codeOnly && <CodeOnlyCard />}
            {marquee && <div className="pointer-events-none absolute border border-brand bg-brand-tint" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, opacity: 0.7 }} />}
            {isEmpty && !activeId && (
              <p className="pointer-events-none absolute right-6 bottom-16 m-0 max-w-[300px] text-right text-label text-text-muted">
                Describe your strategy to Copilot, or press + Add Entry Condition.
              </p>
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeId && (
              // drawn at the canvas zoom, so the moving copy looks like the thing you picked up
              <div className="origin-top-left" style={{ transform: `scale(${view.zoom})` }}>
                <DragCopy id={activeId} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </ChangedContext.Provider>

      {/* Bottom of the canvas: toast and selection bar — white, same surface as popovers */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 [&>*]:pointer-events-auto">
        {toast && !activeId && <CanvasToast text={toast.text} icon={toast.icon} onUndo={toast.undo ? () => useCanvas.getState().undo() : undefined} />}
        {selected.length > 0 && !activeId && <CanvasSelectionBar ids={selected} />}
      </div>

      <ZoomControls zoom={view.zoom} onStep={cam.step} onFit={cam.fit} onReset={() => cam.zoomTo(1, undefined, true)} />
    </section>
  );
}

function CanvasSelectionBar({ ids }: { ids: string[] }) {
  const { group, duplicate, remove, clearSelection } = useCanvas.getState();
  // would the new group go past 2 levels?
  const blocked = useCanvas((s) => {
    const t = { entry: s.entry, exit: s.exit };
    const p = findParent(t.entry, ids[0]) ?? findParent(t.exit, ids[0]);
    if (!p) return undefined;
    const tallest = Math.max(0, ...ids.map((id) => { const n = findNode(t.entry, id) ?? findNode(t.exit, id); return n ? heightOf(n) : 0; }));
    const isRoot = p.id === t.entry.id || p.id === t.exit.id;
    const all = !isRoot && ids.length === p.children.length;
    return !all && levelOf(t, p.id) + 1 + tallest > MAX_DEPTH ? 'Groups go 2 levels deep' : undefined;
  });
  return (
    <SelectionBar
      count={ids.length}
      groupBlocked={ids.length >= 2 ? blocked : undefined}
      onGroup={(w) => group(ids, LOGIC_OF[w])}
      onDuplicate={() => duplicate(ids)}
      onDelete={() => remove(ids)}
      onClear={clearSelection}
    />
  );
}

/* ── Entry and Exit frames ─────────────────────────────────────── */

/**
 * The code holds memory between candles (var, :=): one card replaces the blocks, and adding
 * blocks by hand is off until the code fits again (design/pine-editor §5).
 */
function CodeOnlyCard() {
  const { openLine, checkOnChart } = useCopilot.getState();
  const memory = lineRanges(usePine((s) => s.memoryLines));
  const first = usePine((s) => s.memoryLines[0] ?? 1);
  return (
    <div className="absolute top-16 left-1/2 flex w-[420px] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-border-control bg-surface shadow-surface">
      <div className="flex items-center gap-2 px-3 py-2.5 text-body font-semibold">
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-[6px] bg-surface-selected font-mono text-label font-semibold text-text-secondary">&lt;/&gt;</span>
        <span className="flex-1">Runs from Pine Script</span>
        <FitBadge kind="code" />
      </div>
      <p className="m-0 px-3 pb-3 text-chip leading-[18px] text-text-secondary">
        This strategy keeps memory between candles{memory ? ` (line${memory.includes(',') || memory.includes('–') ? 's' : ''} ${memory})` : ''}, which blocks can’t show. Edit it in code; the chart still shows every trade.
      </p>
      <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-2.5">
        <CardAction onClick={() => openLine(first)}>Edit in code</CardAction>
        <Secondary onClick={checkOnChart}>Check on chart</Secondary>
        <span className="flex-1" />
        <span className="text-label text-text-disabled" title="This strategy runs from code. Change it in Pine Script.">+ Add condition is off</span>
      </div>
    </div>
  );
}

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

  // Exit sits right of Entry until you move it
  const exitPos = frames.exit ?? { x: frames.entry.x + entryWidth + EXIT_GAP, y: frames.entry.y };
  return (
    <>
      <Frame ref={entryRef} side="entry" root={entry} pos={frames.entry} />
      <Frame side="exit" root={exit} pos={exitPos} />
    </>
  );
}

function Frame({ side, root, pos, ref }: { side: Side; root: Group; pos: { x: number; y: number }; ref?: Ref<HTMLDivElement> }) {
  const { addCondition, selectFrame, moveFrame, openEditor, closeEditor, setLogic, setTiming } = useCanvas.getState();
  const isSelected = useCanvas((s) => s.selectedFrame === side);
  const timing = useCanvas((s) => s.timing[side]);
  const editor = useCanvas((s) => s.editor);
  const target = useDragState((s) => (s.target?.parentId === root.id ? s.target : null));
  const dragging = useDragState((s) => !!s.activeId);
  // the whole section is a drop zone too: adds at the end ("Drop here to add it to Entry" when empty)
  const { setNodeRef } = useDroppable({ id: `section:${side}`, data: { parentId: root.id, index: root.children.length, append: true }, disabled: !dragging });
  const logicOpen = editor?.id === root.id && editor.part === 'logic';
  const timingOpen = editor?.id === `timing:${side}`;
  const timingWord = timing === 'close' ? 'On candle close' : 'During the candle';

  // Drag the title to move the whole tree; click it to select the section
  const onHeaderDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectFrame(side);
    const zoom = useCanvas.getState().view.zoom;
    const start = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    const onMove = (ev: PointerEvent) =>
      moveFrame(side, { x: Math.round(start.x + (ev.clientX - start.px) / zoom), y: Math.round(start.y + (ev.clientY - start.py) / zoom) });
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const headerProps = {
    onPointerDown: onHeaderDown,
    'data-frame-header': true,
    title: 'Drag to move. Click to select.',
    className: 'w-max cursor-grab active:cursor-grabbing',
  } as HTMLAttributes<HTMLDivElement>;

  return (
    <div ref={ref} data-frame={side} className="absolute" style={{ left: pos.x - 16, top: pos.y - 16 }}>
      <div ref={setNodeRef}>
        <SectionShell
          side={side}
          word={WORD[root.logic]}
          selected={isSelected}
          drop={target && !root.children.length ? 'valid' : 'none'}
          insertAt={target?.valid && root.children.length ? target.index : undefined}
          onAdd={() => addCondition(side)}
          headerProps={headerProps}
          titleAddon={
            // always-visible grip: says "this whole tree can be dragged"
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" className={isSelected ? 'text-brand' : 'text-text-subtle'}>
              {[3, 7, 11].flatMap((y) => [3, 9].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />))}
            </svg>
          }
          timingSlot={
            <Popover floating open={timingOpen} onClose={closeEditor} trigger={
              <FieldAtom kind="timing" label={timingWord} open={timingOpen} onClick={() => (timingOpen ? closeEditor() : openEditor(`timing:${side}`, 'more'))} />
            }>
              <TimingMenu current={timingWord} onPick={(t) => setTiming(side, t === 'On candle close' ? 'close' : 'during')} />
            </Popover>
          }
          logicSlot={
            <Popover floating open={logicOpen} onClose={closeEditor} trigger={
              <FieldAtom kind="logic" label={WORD[root.logic]} open={logicOpen} onClick={() => (logicOpen ? closeEditor() : openEditor(root.id, 'logic'))} />
            }>
              <LogicMenu current={WORD[root.logic]} onGroup={false} onPick={(w) => setLogic(root.id, LOGIC_OF[w])} />
            </Popover>
          }
        >
          {root.children.map((ch, i) => <TreeRow key={ch.id} node={ch} parentId={root.id} index={i} side={side} />)}
          {CopilotPreviewRows({ side })}
        </SectionShell>
      </div>
    </div>
  );
}

/** Bottom-right: − 100% + and Fit, like Figma's zoom menu. */
function ZoomControls({ zoom, onStep, onFit, onReset }: { zoom: number; onStep: (d: 1 | -1) => void; onFit: () => void; onReset: () => void }) {
  const btn = 'flex h-7 min-w-7 items-center justify-center rounded-chip px-1.5 text-body text-text-secondary hover:bg-surface-selected active:bg-row-pressed disabled:text-text-disabled disabled:hover:bg-transparent';
  return (
    <div role="toolbar" aria-label="Zoom" className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-block border border-border-control bg-surface p-0.5 shadow-surface">
      <button type="button" aria-label="Zoom out" title="Zoom out · ⌘−" disabled={zoom <= MIN_ZOOM} onClick={() => onStep(-1)} className={btn}>−</button>
      <button type="button" title="Back to 100% · ⇧0" onClick={onReset} className={`${btn} w-12 text-label font-medium tabular-nums`}>{Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="Zoom in" title="Zoom in · ⌘+" disabled={zoom >= MAX_ZOOM} onClick={() => onStep(1)} className={btn}>+</button>
      <span className="mx-0.5 h-4 w-px bg-border-control" />
      <button type="button" title="See everything · ⇧1" onClick={onFit} className={`${btn} text-label font-medium`}>Fit</button>
    </div>
  );
}

/**
 * Canvas keys (ignored while typing or inside a popover):
 * ⌘Z undo · ⌘D duplicate · ⌘C copy as text · ⌫ delete · Space ticks the focused block ·
 * ↑ ↓ move one selected item · arrows nudge a selected section · Esc clears.
 */
function useCanvasShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      const c = useCanvas.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) {
        if (c.history.length) { e.preventDefault(); c.undo(); }
      } else if (mod && k === 'd' && c.selected.length) {
        e.preventDefault();
        c.duplicate(c.selected);
      } else if (mod && k === 'c' && c.selected.length) {
        e.preventDefault();
        c.copyAsText(c.selected);
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && c.selected.length) {
        e.preventDefault();
        c.remove(c.selected);
      } else if (e.key === ' ' && el.dataset?.nodeId) {
        e.preventDefault(); // Space ticks the focused block or group
        c.toggleSelect(el.dataset.nodeId);
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && c.selected.length === 1 && !mod) {
        e.preventDefault();
        c.nudge(c.selected[0], e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key.startsWith('Arrow') && c.selectedFrame && !mod) {
        e.preventDefault();
        const frame = document.querySelector<HTMLElement>(`[data-frame="${c.selectedFrame}"]`);
        if (!frame) return;
        const d = e.shiftKey ? 10 : 1;
        c.moveFrame(c.selectedFrame, {
          x: frame.offsetLeft + 16 + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0),
          y: frame.offsetTop + 16 + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0),
        });
      } else if (e.key === 'Escape' && (c.selected.length || c.selectedFrame) && !c.editor) {
        c.clearSelection();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
