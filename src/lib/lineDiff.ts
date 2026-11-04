/*
  Line diffs for the Pine Script editor: which lines you edited since the last Run, which lines
  Copilot changed, and whether a canvas change can slot into your un-run draft quietly
  (design/pine-editor · Conflict: only when the same lines collide).
*/

/** A replaced range of `base` lines [from, to) and what replaces it. */
export interface Hunk {
  from: number;
  to: number;
  lines: string[];
}

/** Lines compare without their spacing: re-aligning "ema9  =" isn't a change. */
const key = (l: string) => l.replace(/\s+/g, ' ').trim();

/** Longest common subsequence: pairs of matching line indexes. */
function lcs(a0: string[], b0: string[]): [number, number][] {
  const a = a0.map(key);
  const b = b0.map(key);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

export function hunks(base: string[], next: string[]): Hunk[] {
  const pairs = [...lcs(base, next), [base.length, next.length] as [number, number]];
  const out: Hunk[] = [];
  let pi = 0;
  let pj = 0;
  for (const [i, j] of pairs) {
    if (i > pi || j > pj) out.push({ from: pi, to: i, lines: next.slice(pj, j) });
    pi = i + 1;
    pj = j + 1;
  }
  return out;
}

/** 1-based lines of `next` that are new or changed compared with `base`. */
export function changedSince(base: string[], next: string[]): number[] {
  const matched = new Set(lcs(base, next).map(([, j]) => j));
  return next.map((l, j) => (!matched.has(j) && l.trim() ? j + 1 : 0)).filter(Boolean);
}

/** How many separate edits there are between two versions (for "Discarded 3 changes"). */
export function changeCount(a: string[], b: string[]) {
  return hunks(a, b).length;
}

/**
 * Three-way merge by lines, kept on `mine`: the hunks from `base` to `theirs` are spliced into
 * `mine` wherever mine still has those base lines untouched. When a hunk lands on a line mine
 * changed, that's a conflict (1-based lines in mine).
 */
export function merge3(base: string[], mine: string[], theirs: string[]): { lines: string[] } | { conflict: [number, number] } {
  const bm = new Map(lcs(base, mine));
  const out = [...mine];
  for (const h of hunks(base, theirs).sort((p, q) => q.from - p.from)) {
    let at: number;
    let len = 0;
    if (h.to > h.from) {
      const js: (number | undefined)[] = [];
      for (let i = h.from; i < h.to; i++) js.push(bm.get(i));
      if (js.some((j, k) => j === undefined || (k > 0 && j !== js[k - 1]! + 1))) {
        const near = bm.get(h.from - 1);
        const line = (near ?? 0) + 2;
        return { conflict: [line, line + Math.max(0, h.to - h.from - 1)] };
      }
      at = js[0]!;
      len = js.length;
    } else {
      // an insertion: right after the base line before it (or before the one after it)
      const before = h.from > 0 ? bm.get(h.from - 1) : -1;
      if (before === undefined) return { conflict: [h.from, h.from] };
      at = before + 1;
    }
    out.splice(at, len, ...h.lines);
  }
  return { lines: out };
}

/**
 * Canvas → code, surgically (design/pine-editor §5): the canvas wrote `before`, now writes `after`.
 * Only the lines that differ between those two go into `code`; the coder's names, comments,
 * spacing and order stay. Null when a changed line collides with a line the coder changed.
 */
export function patchCode(before: string, code: string, after: string): string | null {
  const m = merge3(before.split('\n'), code.split('\n'), after.split('\n'));
  return 'lines' in m ? m.lines.join('\n') : null;
}

/** Lines (1-based) where two versions differ, for "3 lines changed · not run". */
export const changedCount = (ran: string, draft: string) => changedSince(ran.split('\n'), draft.split('\n')).length + hunks(ran.split('\n'), draft.split('\n')).filter((h) => !h.lines.length).length;
