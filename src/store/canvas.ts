import { useMemo } from 'react';
import { create } from 'zustand';
import {
  blankCondition,
  cloneNode,
  describeCondition,
  entryState,
  findNode,
  findParent,
  firstUnfinished,
  fitsIn,
  flatConditions,
  groupNodes,
  heightOf,
  levelOf,
  MAX_DEPTH,
  insertAt,
  logicName,
  moveNode,
  removeNodes,
  replaceNode,
  sideName,
  ungroup,
} from '@/lib/conditions';
import { emptyStrategy } from '@/mock/strategies';
import type { Condition, IndicatorParams, Logic, MathStep, Operand, Relation, Side, StrategyNode, StrategyTree, Timing } from '@/types/strategy';
import { useStrategy } from './strategy';
import { useWorkspace } from './workspace';

/*
  Canvas store = the conditions on the canvas (boards B02–B08, E01–E09).

  Every edit goes through `commit`, which:
    • keeps the old version for Undo
    • tells the strategy store (Saved → edited, backtest setups outdated)
    • pauses the chart and adds one to "Update chart · N changes"
  `applied` is the version the chart was last drawn with (U01).
*/

/** Which menu or dialog is open, and on which block. */
export type EditorPart =
  | 'left' | 'right' // indicator picker (B02, B06, E02)
  | 'leftSettings' | 'rightSettings' // settings dialog (B03, E03)
  | 'leftMath' | 'rightMath' // + − × ÷ (B04)
  | 'relation' // B05
  | 'more' // ⋯ menu (E04)
  | 'logic' // AND / OR menu (B07)
  | 'groupMenu'; // box label menu (E08)

export interface Editor {
  id: string;
  part: EditorPart;
}

/** Where the camera is: pan offset in screen px, and zoom (1 = 100%). */
export interface View {
  x: number;
  y: number;
  zoom: number;
}

/** Top-left of the Entry / Exit frame on the canvas, in canvas px. Exit `null` = sits right of Entry. */
export interface FramePos {
  x: number;
  y: number;
}

/** What Copilot is placing (design/copilot "On the canvas"): skeletons, then ghosts; a placeholder where a question is open. */
export interface CopilotPreview {
  side: Side;
  rows: ({ kind: 'skeleton' } | { kind: 'ghost'; cond: Condition })[];
  placeholder: Side | null;
}

/** A Copilot change to blocks you made, previewed until Apply: dashed blue = will change, dashed red = will be removed. */
export interface PendingChange {
  changes: Record<string, Condition>;
  removals: string[];
}

interface CanvasToast {
  text: string;
  undo: boolean;
  /** ✦ when Copilot made the change, </> after your own Run */
  icon?: 'ai' | 'code';
}

interface CanvasState extends StrategyTree {
  applied: StrategyTree;
  editor: Editor | null;
  selected: string[]; // conditions and groups, one side at a time
  selectedFrame: Side | null; // the whole Entry or Exit tree
  frames: { entry: FramePos; exit: FramePos | null };
  view: View;
  history: StrategyTree[];
  timing: Record<Side, Timing>;
  toast: CanvasToast | null;
  copilotPreview: CopilotPreview | null;
  pending: PendingChange | null;
  /** the strategy runs from Pine Script: the canvas shows one card instead of blocks */
  codeOnly: boolean;
  /** the block a card row points at (and the other way round) */
  linkedHover: string | null;

  load: (t: StrategyTree) => void;
  addCondition: (side: Side, parentId?: string, index?: number) => void;
  addBelow: (id: string) => void;
  setOperand: (id: string, which: 'left' | 'right', o: Operand) => void;
  setRelation: (id: string, r: Relation) => void;
  setMath: (id: string, which: 'left' | 'right', m: MathStep | null) => void;
  /** settings typed in the settings popover; `counts` = the first change of this edit */
  setParams: (id: string, which: 'left' | 'right', p: IndicatorParams, counts: boolean) => void;
  setLogic: (groupId: string, l: Logic) => void;
  duplicate: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  group: (ids: string[], l: Logic) => void;
  setTiming: (side: Side, t: Timing) => void;
  copyAsText: (ids: string[]) => void;
  ungroup: (groupId: string) => void;
  move: (id: string, parentId: string, index: number) => void;
  undo: () => void;

  openEditor: (id: string, part: EditorPart) => void;
  closeEditor: () => void;
  toggleSelect: (id: string) => void;
  selectOnly: (ids: string[]) => void;
  clearSelection: () => void;
  nudge: (id: string, dir: -1 | 1) => void;
  selectFrame: (side: Side | null) => void;
  moveFrame: (side: Side, pos: FramePos) => void;
  setView: (v: View) => void;
  set: (patch: Partial<CanvasState>) => void;
  /** Copilot adds blocks (violet + ✦) at the end of a section; `changes: 0` while it builds one request */
  copilotAdd: (side: Side, nodes: StrategyNode[], description: string, changes?: number) => void;
  /** Copilot's reviewed change, applied */
  copilotCommit: (t: StrategyTree, description: string, toast?: string) => void;
  showToast: (text: string, undo?: boolean, icon?: 'ai' | 'code') => void;
  /** Run in the Pine Script editor: the canvas redraws to match the code, as one undo step */
  fromCode: (t: StrategyTree, extra: Partial<CanvasState>, description: string) => void;
}

const treeOf = (s: StrategyTree): StrategyTree => ({ entry: s.entry, exit: s.exit });
const condOf = (t: StrategyTree, id: string) => {
  const n = findNode(t.entry, id) ?? findNode(t.exit, id);
  return n?.kind === 'cond' ? n : null;
};
const nodeOf = (t: StrategyTree, id: string) => findNode(t.entry, id) ?? findNode(t.exit, id);
const nodeText = (n: StrategyNode | null) =>
  !n ? '' : n.kind === 'cond' ? describeCondition(n) : `${logicName(n.logic)} group`;

/** The rest of the app still reads `entry: empty | partial | complete` from the strategy store. */
const syncEntry = (t: StrategyTree) => useStrategy.setState({ entry: entryState(t) });

let toastTimer: ReturnType<typeof setTimeout> | undefined;

const empty = emptyStrategy();

export const useCanvas = create<CanvasState>((set, get) => {
  /** `changes`: 0 when filling an empty slot of a new block — the block already counted as one change. */
  const commit = (next: StrategyTree, description: string, extra: Partial<CanvasState> = {}, changes = 1) => {
    const s = get();
    set({ ...next, history: [...s.history.slice(-49), treeOf(s)], ...extra });
    syncEntry(next);
    useStrategy.getState().edit(description, changes);
  };

  const showToast = (text: string, undo = true, icon?: 'ai' | 'code') => {
    clearTimeout(toastTimer);
    set({ toast: { text, undo, icon } });
    toastTimer = setTimeout(() => set({ toast: null }), 8000); // Undo stays 8 seconds
  };

  const updateCond = (id: string, patch: Partial<Condition>, description: string, editor: Editor | null) => {
    const t = treeOf(get());
    const c = condOf(t, id);
    if (!c) return;
    const fillsEmptySlot = Object.keys(patch).every((k) => c[k as keyof Condition] === null);
    // your own edit turns a Copilot block into a normal one (✦ goes away)
    commit(replaceNode(t, id, { ...c, ...patch, copilot: false }), description, { editor }, fillsEmptySlot ? 0 : 1);
  };

  return {
    ...empty,
    applied: empty,
    editor: null,
    selected: [],
    selectedFrame: null,
    frames: { entry: { x: 48, y: 32 }, exit: null },
    view: { x: 0, y: 0, zoom: 1 },
    history: [],
    copilotPreview: null,
    pending: null,
    codeOnly: false,
    linkedHover: null,
    timing: { entry: 'close', exit: 'close' },
    toast: null,

    load: (t) => {
      set({ ...t, applied: t, editor: null, selected: [], selectedFrame: null, history: [], toast: null });
      syncEntry(t);
    },

    addCondition: (side, parentId, index) => {
      // a code-only strategy can't take blocks by hand (design/pine-editor §5)
      if (get().codeOnly) return;
      const t = treeOf(get());
      const root = t[side];
      const parent = parentId ?? root.id;
      const c = blankCondition();
      const at = index ?? (findNode(root, parent) as { children: StrategyNode[] }).children.length;
      commit(insertAt(t, parent, at, [c]), `added a condition to ${sideName(side)}`, {
        editor: { id: c.id, part: 'left' },
        selected: [],
      });
    },

    addBelow: (id) => {
      const t = treeOf(get());
      const parent = findParent(t.entry, id) ?? findParent(t.exit, id);
      if (!parent) return;
      const side = findNode(t.entry, id) ? 'entry' : 'exit';
      get().addCondition(side, parent.id, parent.children.findIndex((c) => c.id === id) + 1);
    },

    // Building a new block walks you through it: Indicator 1 → Relation → Indicator 2 (B02 → B05 → B06)
    setOperand: (id, which, o) => {
      const c = condOf(treeOf(get()), id);
      if (!c) return;
      const prev = c[which];
      const keep = prev?.math ? { ...o, math: prev.math } : o;
      const next = { ...c, [which]: keep };
      const editor: Editor | null =
        which === 'left' && !c.relation ? { id, part: 'relation' } : which === 'left' && !c.right ? { id, part: 'right' } : null;
      const verb = prev ? `changed ${describeCondition(c)} → ${describeCondition(next)}` : `set ${describeCondition(next)}`;
      updateCond(id, { [which]: keep }, verb, editor);
    },

    setRelation: (id, relation) => {
      const c = condOf(treeOf(get()), id);
      if (!c) return;
      const editor: Editor | null = c.right ? null : { id, part: 'right' };
      updateCond(id, { relation }, `changed relation to ${relation} in ${describeCondition(c)}`, editor);
    },

    setMath: (id, which, math) => {
      const c = condOf(treeOf(get()), id);
      const o = c?.[which];
      if (!c || !o) return;
      updateCond(id, { [which]: { ...o, math: math ?? undefined } }, `${math ? 'set' : 'removed'} arithmetic in ${describeCondition(c)}`, null);
    },

    setParams: (id, which, params, counts) => {
      const t = treeOf(get());
      const c = condOf(t, id);
      const o = c?.[which];
      if (!c || !o || o.type !== 'indicator') return;
      const next = { ...c, [which]: { ...o, params }, copilot: false };
      commit(replaceNode(t, id, next), `changed settings of ${describeCondition(c)}`, {}, counts ? 1 : 0);
    },

    setLogic: (groupId, logic) => {
      const t = treeOf(get());
      const g = nodeOf(t, groupId);
      if (!g || g.kind !== 'group' || g.logic === logic) return set({ editor: null });
      commit(replaceNode(t, groupId, { ...g, logic }), `switched a box to ${logicName(logic)}`, { editor: null });
    },

    duplicate: (ids) => {
      let t = treeOf(get());
      for (const id of ids) {
        const node = nodeOf(t, id);
        const parent = findParent(t.entry, id) ?? findParent(t.exit, id);
        if (!node || !parent) continue;
        t = insertAt(t, parent.id, parent.children.findIndex((c) => c.id === id) + 1, [cloneNode(node)]);
      }
      commit(t, `duplicated ${ids.length > 1 ? `${ids.length} conditions` : nodeText(nodeOf(treeOf(get()), ids[0]))}`, {
        editor: null,
        selected: [],
      });
    },

    // Delete is instant, with Undo (E05)
    remove: (ids) => {
      const t = treeOf(get());
      const one = ids.length === 1 ? nodeOf(t, ids[0]) : null;
      // "Deleted Any of group · 2 conditions" — a group goes with its conditions, in one step
      const what = one?.kind === 'group' ? `${nodeText(one)} · ${flatConditions(one).length} conditions` : one ? nodeText(one) : `${ids.length} items`;
      commit(removeNodes(t, ids), `removed ${what}`, { editor: null, selected: [] });
      showToast(`Deleted ${what}`);
    },

    group: (ids, logic) => {
      const t = treeOf(get());
      const parent = findParent(t.entry, ids[0]) ?? findParent(t.exit, ids[0]);
      if (!parent) return;
      // ticking everything in a box = just changing that box's logic
      const isRoot = parent.id === t.entry.id || parent.id === t.exit.id;
      if (!isRoot && ids.length === parent.children.length) return get().setLogic(parent.id, logic);
      // the new box sits one level below its parent; nothing inside may go past 2 levels
      const tallest = Math.max(0, ...ids.map((id) => heightOf(nodeOf(t, id)!)));
      if (levelOf(t, parent.id) + 1 + tallest > MAX_DEPTH) return;
      const res = groupNodes(t, ids, logic);
      if (!res) return;
      commit(res.tree, `grouped ${ids.length} conditions as ${logicName(logic)}`, { editor: null, selected: [] });
      showToast(`Grouped ${ids.length} conditions as ${logicName(logic)}`);
    },

    ungroup: (groupId) => {
      commit(ungroup(treeOf(get()), groupId), 'ungrouped a group', { editor: null });
      showToast('Ungrouped');
    },

    // Drag by ⋮⋮ (E09)
    move: (id, parentId, index) => {
      const t = treeOf(get());
      const node = nodeOf(t, id);
      if (!node || !fitsIn(t, node, parentId)) return; // too deep: nothing moves
      const next = moveNode(t, id, parentId, index);
      if (next === t) return;
      const target = nodeOf(t, parentId);
      const into = target?.kind === 'group' && t.entry.id !== parentId && t.exit.id !== parentId ? ` into ${logicName(target.logic)}` : '';
      commit(next, `moved ${nodeText(nodeOf(t, id))}${into}`, { editor: null });
    },

    setTiming: (side, timing) => {
      if (get().timing[side] === timing) return set({ editor: null });
      set((s) => ({ timing: { ...s.timing, [side]: timing }, editor: null }));
      useStrategy.getState().edit(`${sideName(side)} now checks ${timing === 'close' ? 'on candle close' : 'during the candle'}`);
    },

    // ⌘C: plain words, one condition per line, groups indented
    copyAsText: (ids) => {
      const t = treeOf(get());
      const line = (n: StrategyNode, pad: string): string =>
        n.kind === 'cond' ? `${pad}${describeCondition(n)}` : [`${pad}${logicName(n.logic)}:`, ...n.children.map((c) => line(c, pad + '  '))].join('\n');
      const text = ids.map((id) => nodeOf(t, id)).filter(Boolean).map((n) => line(n!, '')).join('\n');
      void navigator.clipboard?.writeText(text).catch(() => undefined);
      showToast(ids.length > 1 ? `Copied ${ids.length} items as text` : 'Copied as text', false);
    },

    undo: () => {
      const s = get();
      const prev = s.history[s.history.length - 1];
      if (!prev) return;
      clearTimeout(toastTimer);
      set({ ...prev, history: s.history.slice(0, -1), editor: null, selected: [], toast: null });
      syncEntry(prev);
      useStrategy.getState().edit('undid the last change');
    },

    openEditor: (id, part) => set({ editor: { id, part } }),
    closeEditor: () => set({ editor: null }),
    toggleSelect: (id) =>
      set((s) => {
        // a selection stays among siblings (same box, same tree), so it can always be grouped
        const t = treeOf(s);
        const parentOf = (x: string) => (findParent(t.entry, x) ?? findParent(t.exit, x))?.id;
        const siblings = s.selected.filter((x) => parentOf(x) === parentOf(id));
        return {
          editor: null,
          selectedFrame: null,
          selected: siblings.includes(id) ? siblings.filter((x) => x !== id) : [...siblings, id],
        };
      }),
    selectOnly: (ids) => set({ selected: ids, selectedFrame: null, editor: null }),
    clearSelection: () => set({ selected: [], selectedFrame: null }),

    // ↑ / ↓ on a selected block: swap with its neighbour; at the edge of a group, step out of it
    nudge: (id, dir) => {
      const t = treeOf(get());
      const parent = findParent(t.entry, id) ?? findParent(t.exit, id);
      if (!parent) return;
      const i = parent.children.findIndex((c) => c.id === id);
      const j = i + dir;
      if (j >= 0 && j < parent.children.length) return get().move(id, parent.id, dir < 0 ? j : j + 1);
      const grand = findParent(t.entry, parent.id) ?? findParent(t.exit, parent.id);
      if (!grand) return;
      const p = grand.children.findIndex((c) => c.id === parent.id);
      get().move(id, grand.id, dir < 0 ? p : p + 1);
    },

    // Layout only: moving a frame or the camera never changes the strategy
    selectFrame: (side) => set({ selectedFrame: side, selected: [], editor: null }),
    moveFrame: (side, pos) => set((s) => ({ frames: { ...s.frames, [side]: pos } })),
    setView: (view) => set({ view }),
    set: (patch) => set(patch),

    copilotAdd: (side, nodes, description, changes = 1) => {
      const t = treeOf(get());
      const mark = (n: StrategyNode): StrategyNode => (n.kind === 'cond' ? { ...n, copilot: true } : { ...n, children: n.children.map(mark) });
      commit(insertAt(t, t[side].id, t[side].children.length, nodes.map(mark)), description, {}, changes);
    },
    copilotCommit: (next, description, toast) => {
      commit(next, description, { pending: null });
      if (toast) showToast(toast, true, 'ai');
    },
    fromCode: (next, extra, description) => commit(next, description, { editor: null, selected: [], pending: null, ...extra }),
    showToast,
  };
});

/** The chart was just redrawn: remember which conditions it was drawn with. */
useWorkspace.subscribe((s, prev) => {
  if (s.applied !== prev.applied && s.chartStatus === 'updated') useCanvas.setState((c) => ({ applied: treeOf(c) }));
});

/** The box (or tree) the selection lives in. Blocks in it can join the selection. */
export const useSelectionParent = () =>
  useCanvas((s) => {
    const first = s.selected[0];
    if (!first) return null;
    return (findParent(s.entry, first) ?? findParent(s.exit, first))?.id ?? null;
  });

/** Bottom bar: "Finish condition 3 first" (U02). */
export function useUnfinished() {
  const entry = useCanvas((s) => s.entry);
  const exit = useCanvas((s) => s.exit);
  return useMemo(() => firstUnfinished({ entry, exit }), [entry, exit]);
}
