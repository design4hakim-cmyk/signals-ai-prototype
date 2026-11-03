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

/** Longest common subsequence: pairs of matching line indexes. */
function lcs(a: string[], b: string[]): [number, number][] {
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

/** How many lines differ between two versions (for "Discarded 3 changes"). */
export function changeCount(a: string[], b: string[]) {
  return hunks(a, b).reduce((n, h) => n + Math.max(h.to - h.from, h.lines.length), 0);
}

/**
 * Three-way merge by lines. `mine` = your un-run draft, `theirs` = the code the canvas now writes,
 * both from `base` (the code that last ran). Null when the same lines changed on both sides.
 */
export function merge3(base: string[], mine: string[], theirs: string[]): { lines: string[] } | { conflict: [number, number] } {
  const a = hunks(base, mine);
  const b = hunks(base, theirs);
  for (const x of a)
    for (const y of b) {
      const touch = x.from < y.to && y.from < x.to;
      const sameSpot = x.from === y.from && (x.to === x.from || y.to === y.from);
      if (touch || sameSpot) {
        // report the lines in your draft that collide (1-based)
        const start = x.from + 1;
        return { conflict: [start, Math.max(start, start + x.lines.length - 1)] };
      }
    }
  const all = [...a, ...b].sort((p, q) => q.from - p.from);
  const out = [...base];
  for (const h of all) out.splice(h.from, h.to - h.from, ...h.lines);
  return { lines: out };
}
