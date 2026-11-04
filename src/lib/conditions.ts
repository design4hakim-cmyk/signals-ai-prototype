import type { Condition, Group, Logic, Side, StrategyNode, StrategyTree } from '@/types/strategy';
import { operandText } from './indicators';

/*
  Pure helpers for the condition tree. Every edit returns a NEW tree
  (nothing is changed in place), which is what makes Undo easy.
*/

let n = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++n}`;

export const emptyGroup = (logic: Logic = 'AND'): Group => ({ kind: 'group', id: uid('g'), logic, children: [] });
export const blankCondition = (): Condition => ({ kind: 'cond', id: uid('c'), left: null, relation: null, right: null });

export const isComplete = (c: Condition) => !!c.custom || !!(c.left && c.relation && c.right);

/** Every condition in reading order (top to bottom, into groups). */
export function flatConditions(g: Group): Condition[] {
  return g.children.flatMap((ch) => (ch.kind === 'cond' ? [ch] : flatConditions(ch)));
}

export function findNode(g: Group, id: string): StrategyNode | null {
  if (g.id === id) return g;
  for (const ch of g.children) {
    if (ch.id === id) return ch;
    if (ch.kind === 'group') {
      const hit = findNode(ch, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function findParent(g: Group, id: string): Group | null {
  for (const ch of g.children) {
    if (ch.id === id) return g;
    if (ch.kind === 'group') {
      const hit = findParent(ch, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function sideOf(t: StrategyTree, id: string): Side | null {
  if (findNode(t.entry, id)) return 'entry';
  if (findNode(t.exit, id)) return 'exit';
  return null;
}

/** Is `id` the node `ancestorId` or somewhere inside it? (Can't drop a group into itself.) */
export function isInside(t: StrategyTree, id: string, ancestorId: string) {
  const anc = findNode(t.entry, ancestorId) ?? findNode(t.exit, ancestorId);
  return !!anc && (anc.id === id || (anc.kind === 'group' && !!findNode(anc, id)));
}

/**
 * Rebuild a group, replacing nodes by id.
 * Empty sub-groups disappear, and a sub-group left with ONE thing dissolves:
 * that thing joins the parent (COMPONENTS.md §6 "Last one out").
 */
function mapGroup(g: Group, f: (node: StrategyNode) => StrategyNode | StrategyNode[] | null): Group {
  const children = g.children.flatMap((ch) => {
    const out = f(ch);
    const list = out === null ? [] : Array.isArray(out) ? out : [out];
    return list.map((x) => (x.kind === 'group' && x === ch ? mapGroup(x, f) : x));
  });
  return {
    ...g,
    children: children
      .filter((ch) => ch.kind === 'cond' || ch.children.length > 0)
      .map((ch) => (ch.kind === 'group' && ch.children.length === 1 ? ch.children[0] : ch)),
  };
}

/* ── Depth: groups go at most 2 levels deep ────────────────────── */

export const MAX_DEPTH = 2;
export const TOO_DEEP = 'Groups go 2 levels deep. Drop it next to the group instead.';

/** Level of a group: the section root is 0, a box in it is 1, a box in that is 2. */
export function levelOf(t: StrategyTree, groupId: string): number {
  for (const root of [t.entry, t.exit]) {
    const walk = (g: Group, lvl: number): number => {
      if (g.id === groupId) return lvl;
      for (const ch of g.children) if (ch.kind === 'group') { const r = walk(ch, lvl + 1); if (r >= 0) return r; }
      return -1;
    };
    const r = walk(root, 0);
    if (r >= 0) return r;
  }
  return -1;
}

/** How many box levels a node brings with it: a condition 0, a box 1, a box with a box inside 2. */
export const heightOf = (n: StrategyNode): number =>
  n.kind === 'cond' ? 0 : 1 + Math.max(0, ...n.children.map(heightOf));

/** Can this node live inside that group without going too deep? */
export const fitsIn = (t: StrategyTree, node: StrategyNode, parentId: string) => levelOf(t, parentId) + heightOf(node) <= MAX_DEPTH;

function onBothSides(t: StrategyTree, f: (g: Group) => Group): StrategyTree {
  return { entry: f(t.entry), exit: f(t.exit) };
}

export function replaceNode(t: StrategyTree, id: string, next: StrategyNode): StrategyTree {
  return onBothSides(t, (root) => (root.id === id ? (next as Group) : mapGroup(root, (ch) => (ch.id === id ? next : ch))));
}

export function removeNodes(t: StrategyTree, ids: string[]): StrategyTree {
  return onBothSides(t, (root) => mapGroup(root, (ch) => (ids.includes(ch.id) ? null : ch)));
}

/** Insert into a group (by id, root groups included) at an index. */
export function insertAt(t: StrategyTree, parentId: string, index: number, nodes: StrategyNode[]): StrategyTree {
  const ins = (g: Group): Group => {
    if (g.id === parentId) {
      const children = [...g.children];
      children.splice(Math.min(index, children.length), 0, ...nodes);
      return { ...g, children };
    }
    return { ...g, children: g.children.map((ch) => (ch.kind === 'group' ? ins(ch) : ch)) };
  };
  return onBothSides(t, ins);
}

/** Copy with fresh ids (Duplicate). */
export function cloneNode(node: StrategyNode): StrategyNode {
  return node.kind === 'cond' ? { ...node, id: uid('c') } : { ...node, id: uid('g'), children: node.children.map(cloneNode) };
}

/** Move a node to a new parent and position (drag and drop). */
export function moveNode(t: StrategyTree, id: string, parentId: string, index: number): StrategyTree {
  const node = findNode(t.entry, id) ?? findNode(t.exit, id);
  const from = findParent(t.entry, id) ?? findParent(t.exit, id);
  if (!node || !from || isInside(t, parentId, id)) return t;
  const fromIndex = from.children.findIndex((c) => c.id === id);
  // dropping just above or below itself changes nothing
  if (from.id === parentId && (index === fromIndex || index === fromIndex + 1)) return t;
  const adjusted = from.id === parentId && fromIndex < index ? index - 1 : index;
  // remove without dropping the (possibly now empty) source group until after insert
  const without: StrategyTree = onBothSides(t, (root) => {
    const strip = (g: Group): Group => ({
      ...g,
      children: g.children.filter((c) => c.id !== id).map((c) => (c.kind === 'group' ? strip(c) : c)),
    });
    return strip(root);
  });
  const placed = insertAt(without, parentId, adjusted, [node]);
  return onBothSides(placed, (root) => mapGroup(root, (ch) => ch));
}

/** Wrap the chosen nodes in a new ANY OF / ALL OF box, where the first of them was. */
export function groupNodes(t: StrategyTree, ids: string[], logic: Logic): { tree: StrategyTree; groupId: string } | null {
  const all = [...flatAll(t.entry), ...flatAll(t.exit)];
  const ordered = all.filter((nd) => ids.includes(nd.id));
  if (ordered.length < 2) return null;
  const group: Group = { kind: 'group', id: uid('g'), logic, children: ordered };
  // put a placeholder where the first one was, remove the rest, then swap the placeholder for the box
  const marked = replaceNode(t, ordered[0].id, { ...blankCondition(), id: '__slot__' });
  const cleared = removeNodes(marked, ordered.slice(1).map((x) => x.id));
  return { tree: replaceNode(cleared, '__slot__', group), groupId: group.id };
}

function flatAll(g: Group): StrategyNode[] {
  return g.children.flatMap((ch) => (ch.kind === 'cond' ? [ch] : [ch, ...flatAll(ch)]));
}

export function ungroup(t: StrategyTree, groupId: string): StrategyTree {
  return onBothSides(t, (root) => mapGroup(root, (ch) => (ch.id === groupId && ch.kind === 'group' ? ch.children : ch)));
}

/* ── Words ─────────────────────────────────────────────────────── */

/** "RSI (14) Greater Than 50", or with a separator: "RSI (14) · Greater Than · 50" */
export const describeCondition = (c: Condition, sep = ' ') =>
  c.custom ? c.custom.text : [operandText(c.left), c.relation ?? '…', operandText(c.right)].join(sep);

export const logicName = (l: Logic) => (l === 'OR' ? 'Any of' : l === 'NONE' ? 'None of' : 'All of');
export const sideName = (s: Side) => (s === 'entry' ? 'Entry' : 'Exit');

/** The first half-built condition, numbered like a person counts: "condition 3". */
export function firstUnfinished(t: StrategyTree): { side: Side; number: number; id: string } | null {
  for (const side of ['entry', 'exit'] as const) {
    const list = flatConditions(t[side]);
    const i = list.findIndex((c) => !isComplete(c));
    if (i >= 0) return { side, number: i + 1, id: list[i].id };
  }
  return null;
}

/** What the rest of the app needs to know: is there an entry, and is it finished? */
export function entryState(t: StrategyTree): 'empty' | 'partial' | 'complete' {
  if (flatConditions(t.entry).length === 0) return 'empty';
  return firstUnfinished(t) ? 'partial' : 'complete';
}
