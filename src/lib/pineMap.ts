import { flatConditions } from '@/lib/conditions';
import { pineFor } from '@/lib/pine';
import { shape } from '@/lib/pineParse';
import type { Condition, Group, StrategyNode, StrategyTree } from '@/types/strategy';

/*
  Code ↔ canvas mapping (design/pine-editor §5 · Source map).
    • sourceMap: every block knows its lines (its term + its variables); every line knows its block.
    • reconcile: after a Run, blocks that didn't change keep their ids, so only the changed
      ones glow once (and the canvas doesn't redraw what stayed the same).
*/

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The text one condition writes, e.g. "ta.crossover(ema9, ema21)" or "rsi > 50". */
function termOf(c: Condition): { term: string; vars: string[] } {
  // write the condition alone; its variable lines are the ones before the entry line
  const lines = pineFor({ entry: { kind: 'group', id: '', logic: 'AND', children: [c] }, exit: { kind: 'group', id: '', logic: 'AND', children: [] } }, '');
  const entry = lines.find((l) => l.startsWith('longOk = '))!.slice('longOk = '.length);
  const vars = lines.slice(3, lines.indexOf('', 3)).map((l) => l.split('=')[0].trim().replace(/^\[|\]$/g, ''));
  return { term: entry, vars };
}

/** condition id → its 1-based lines in `code` (term line first). */
export function sourceMap(code: string, t: StrategyTree): Map<string, number[]> {
  const lines = code.split('\n').map((l) => norm(l.replace(/\/\/.*$/, '')));
  const out = new Map<string, number[]>();
  for (const c of [...flatConditions(t.entry), ...flatConditions(t.exit)]) {
    if (c.custom) {
      const def = lines.findIndex((l) => l.startsWith(`${c.custom!.name} =`));
      const use = lines.findIndex((l, i) => i !== def && new RegExp(`\\b${c.custom!.name}\\b`).test(l));
      out.set(c.id, [use, def].filter((i) => i >= 0).map((i) => i + 1));
      continue;
    }
    if (!c.left || !c.right || !c.relation) continue;
    const { term, vars } = termOf(c);
    const at = lines.findIndex((l) => (l.startsWith('longOk =') || l.startsWith('if ')) && l.includes(norm(term)));
    const defs = vars.flatMap((v) => {
      const names = v.split(',').map((x) => x.trim());
      const i = lines.findIndex((l) => names.some((n) => l.startsWith(`${n} =`) || l.startsWith(`[${n}`)));
      return i >= 0 ? [i] : [];
    });
    out.set(c.id, [at, ...defs].filter((i) => i >= 0).map((i) => i + 1));
  }
  return out;
}

/** The block a line belongs to (its term line wins over a shared variable line). */
export function blockAt(map: Map<string, number[]>, line: number): string | null {
  for (const [id, ls] of map) if (ls[0] === line) return id;
  for (const [id, ls] of map) if (ls.includes(line)) return id;
  return null;
}

/**
 * Give unchanged blocks of `next` the ids they had in `prev`. Returns the tree and the ids that
 * are new or changed (they glow once).
 */
export function reconcile(prev: StrategyTree, next: StrategyTree): { tree: StrategyTree; changed: string[] } {
  const key = (c: Condition) => JSON.stringify(shape({ entry: { kind: 'group', id: '', logic: 'AND', children: [c] }, exit: { kind: 'group', id: '', logic: 'AND', children: [] } }));
  const pool = [...flatConditions(prev.entry), ...flatConditions(prev.exit)].map((c) => ({ c, k: key(c), used: false }));
  const changed: string[] = [];
  const fixCond = (c: Condition, idx: number, side: Condition[]): Condition => {
    const same = pool.find((p) => !p.used && p.k === key(c));
    if (same) { same.used = true; return { ...c, id: same.c.id, copilot: same.c.copilot }; }
    // the same block with a new value: keep its id (it "changed"), else it's new
    const like = pool.find((p) => !p.used && p.c.left?.type === 'indicator' && c.left?.type === 'indicator' && p.c.left.id === c.left.id && side.indexOf(p.c) === idx);
    if (like) { like.used = true; changed.push(like.c.id); return { ...c, id: like.c.id }; }
    changed.push(c.id);
    return c;
  };
  const walk = (g: Group, old: Group | undefined): Group => {
    const oldConds = old ? old.children.filter((x): x is Condition => x.kind === 'cond') : [];
    const kids: StrategyNode[] = g.children.map((ch, i) => {
      if (ch.kind === 'cond') return fixCond(ch, g.children.filter((x) => x.kind === 'cond').indexOf(ch), oldConds);
      const oldGroup = old?.children.filter((x): x is Group => x.kind === 'group')[g.children.slice(0, i).filter((x) => x.kind === 'group').length];
      return walk(ch, oldGroup);
    });
    return { ...g, id: old?.id ?? g.id, children: kids };
  };
  return { tree: { entry: walk(next.entry, prev.entry), exit: walk(next.exit, prev.exit) }, changed };
}
