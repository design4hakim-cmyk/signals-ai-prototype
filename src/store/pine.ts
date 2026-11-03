import { create } from 'zustand';
import { flatConditions } from '@/lib/conditions';
import { changeCount, changedSince, merge3 } from '@/lib/lineDiff';
import { pineText } from '@/lib/pine';
import { compile, lineRanges, sameTree, treeDiff, type Problem } from '@/lib/pineParse';
import { EXAMPLES } from '@/mock/pine';
import type { StrategyTree, Timing } from '@/types/strategy';
import { useCanvas } from './canvas';
import { useStrategy } from './strategy';
import { useWorkspace } from './workspace';

/*
  Pine Script editor store (design/pine-editor · 0 The sync model).
  The Pine Script is the source; the canvas and chart are views of the last code that ran.
    • canvas edit by hand → the code is rewritten silently (no bar, toast or highlight)
    • typing → only the code changes ("Edited · not run"); Run moves it to the canvas + chart
    • Copilot → canvas and code change together; its lines are violet
    • Discard → back to the snapshot taken when the editor opened (one undo step, toast + Undo)
    • close with un-run code → kept as a draft (blue dot on the toggle)
*/

export interface LogLine {
  id: number;
  time: string;
  text: string;
  tone: 'ok' | 'error' | 'needs' | 'muted';
  tag?: string;
  problemId?: string;
}

export interface PineToast {
  text: string;
  sub?: string;
  undo?: () => void;
}

interface Snapshot {
  code: string;
  ran: string;
  tree: StrategyTree;
  timing: Record<'entry' | 'exit', Timing>;
  codeOnly: boolean;
}

type Review =
  | { mode: 'all'; selected: string[]; answers: Record<string, number> }
  | { mode: 'one'; index: number; fixed: number; skipped: string[] };

interface PineState {
  open: boolean;
  /** what's in the editor */
  code: string;
  /** the code that last ran: what the canvas and chart show */
  ran: string;
  snapshot: Snapshot | null;
  /** closed with code that hasn't run */
  draft: boolean;
  running: boolean;
  problems: Problem[];
  /** the AI fix being applied (spinner on its card) */
  fixing: string | null;
  /** problem ids closed with Ignore (the log's "Fix with AI" reopens them) */
  closed: string[];
  /** chosen option per needs-you problem */
  answers: Record<string, number>;
  review: Review | null;
  /** green for 2s after an AI fix */
  justFixed: { line: number; from: number; to: number } | null;
  /** lines Copilot just changed (violet) */
  aiLines: number[];
  aiNote: string;
  aiUndo: (() => void) | null;
  banner: null | { kind: 'draft' } | { kind: 'conflict'; lines: [number, number]; canvas: string };
  log: LogLine[];
  logOpen: boolean;
  toast: PineToast | null;
  /** where the caret should go (Open line N, F8) */
  focus: { line: number; n: number } | null;
  memoryLines: number[];

  openEditor: (line?: number) => void;
  closeEditor: () => void;
  type: (code: string) => void;
  run: (opts?: { quiet?: boolean; after?: string }) => void;
  fix: (id: string) => void;
  ignore: (id: string) => void;
  reopen: (id: string) => void;
  choose: (id: string, option: number) => void;
  applyAnswer: (id: string) => void;
  startReview: () => void;
  toggleReview: (id: string) => void;
  applyReview: () => void;
  oneByOne: () => void;
  stepOne: (dir: 1 | -1) => void;
  fixOne: () => void;
  skipOne: () => void;
  fixRemaining: () => void;
  closeReview: () => void;
  unsupported: (id: string, option: number) => void;
  discard: () => void;
  keepMine: () => void;
  useCanvasVersion: () => void;
  loadExample: (id: string) => void;
  copilotChanged: (before: string, note: string, undo: () => void) => void;
  /** Copilot wrote code the canvas can't draw: it runs from Pine Script */
  copilotCode: (code: string, note: string) => void;
  goTo: (line: number) => void;
  nextProblem: () => void;
  set: (p: Partial<PineState>) => void;
}

/* ── helpers ───────────────────────────────────────────────────── */

const C = () => useCanvas.getState();
const lines = (s: string) => s.split('\n');
const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
let logId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let fixedTimer: ReturnType<typeof setTimeout> | undefined;
/** true while Run writes to the canvas, so the canvas → code sync doesn't answer itself */
let applying = false;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const nameNow = () => useStrategy.getState().name ?? 'Untitled strategy';
/** The code the canvas writes right now. */
export const canvasCode = () => pineText({ entry: C().entry, exit: C().exit }, nameNow(), { timing: C().timing });

/** Lengths of the variables on the canvas, so "needs you" can suggest the one that matches. */
function hints() {
  const lengths: Record<string, number> = {};
  for (const c of [...flatConditions(C().entry), ...flatConditions(C().exit)])
    for (const o of [c.left, c.right])
      if (o?.type === 'indicator' && o.params.length) lengths[`${o.id}${o.params.length}`] = o.params.length;
  return { lengths };
}

/** Counts for the chart after a Run (same engine as Copilot's proof). */
async function refreshChart() {
  const { countsNow } = await import('./copilot');
  useWorkspace.getState().updateChart(countsNow());
}

export const usePine = create<PineState>((set, get) => {
  const log = (l: Omit<LogLine, 'id' | 'time'>, replace = false) =>
    set((s) => ({ log: [...(replace ? [] : s.log.slice(-5)), { ...l, id: ++logId, time: stamp() }] }));
  const toast = (t: PineToast | null, ms = 6000) => {
    clearTimeout(toastTimer);
    set({ toast: t });
    if (t) toastTimer = setTimeout(() => set({ toast: null }), ms);
  };
  /** Put the line(s) for one problem into the code. `text` may hold several lines ("" removes the line). */
  const replaceLine = (code: string, line: number, text: string) => {
    const ls = lines(code);
    if (text === '') ls.splice(line - 1, 1);
    else ls.splice(line - 1, 1, ...text.split('\n'));
    return ls.join('\n');
  };
  const state = () => ({ code: get().code, ran: get().ran, tree: { entry: C().entry, exit: C().exit }, timing: C().timing, codeOnly: C().codeOnly });
  const restore = (s: Snapshot, description: string) => {
    applying = true;
    C().fromCode(s.tree, { timing: s.timing, codeOnly: s.codeOnly }, description);
    applying = false;
    set({ code: s.code, ran: s.ran, problems: [], review: null, aiLines: [], banner: null, memoryLines: s.codeOnly ? get().memoryLines : [] });
    void refreshChart();
  };

  return {
    open: false,
    code: '',
    ran: '',
    snapshot: null,
    draft: false,
    running: false,
    problems: [],
    fixing: null,
    closed: [],
    answers: {},
    review: null,
    justFixed: null,
    aiLines: [],
    aiNote: '',
    aiUndo: null,
    banner: null,
    log: [],
    logOpen: true,
    toast: null,
    focus: null,
    memoryLines: [],

    // Opening saves the snapshot Discard goes back to
    openEditor: (line) => {
      const s = get();
      // the code that ran stays as you wrote it (names, comments) while it still matches the canvas
      const ran = s.ran && (C().codeOnly || s.ran.includes(`strategy("${nameNow()}"`)) ? s.ran : canvasCode();
      const code = s.draft ? s.code : ran;
      set({
        open: true, ran, code, draft: false,
        banner: s.draft ? { kind: 'draft' } : null,
        snapshot: { code: ran, ran, tree: { entry: C().entry, exit: C().exit }, timing: C().timing, codeOnly: C().codeOnly },
        log: s.log.length ? s.log : [{ id: ++logId, time: stamp(), text: `In sync with canvas · last run ${stamp().slice(0, 5)}`, tone: 'ok' }],
        focus: line ? { line, n: Date.now() } : null,
      });
    },
    closeEditor: () => set((s) => ({ open: false, draft: s.code !== s.ran, banner: null, review: null, toast: null })),

    type: (code) => set((s) => ({ code, problems: s.problems.length ? [] : s.problems, review: null, banner: s.banner?.kind === 'conflict' ? s.banner : null })),

    run: (opts = {}) => {
      const code = get().code;
      set({ running: true, review: null });
      if (!opts.quiet) log({ text: 'Compiling…', tone: 'muted' }, true);
      setTimeout(() => {
        const r = compile(code, hints());
        if (!r.ok) {
          set({ running: false, problems: r.problems, closed: [], answers: {}, logOpen: r.problems.length < 3 });
          set({ log: [] });
          for (const p of r.problems.slice(0, 3))
            log({ text: p.message, tone: p.kind === 'needs' || p.kind === 'unsupported' ? 'needs' : 'error', tag: `${p.kind === 'unsupported' ? 'Info' : 'Error'} ${p.line}:${p.col}`, problemId: p.id });
          set({ focus: { line: r.problems[0].line, n: Date.now() } });
          return;
        }
        const before = { entry: C().entry, exit: C().exit };
        const nothing = !r.codeOnly && !C().codeOnly && sameTree(before, r.tree);
        set({ running: false, problems: [], ran: code, memoryLines: r.memoryLines, banner: null });
        if (nothing) {
          // same blocks and timing: comments, spacing or names changed
          if (opts.after) log({ text: opts.after, tone: 'ok' }, true);
          log({ text: 'Ran · nothing to update', tone: 'ok' }, !opts.after);
          if (!opts.quiet) toast({ text: 'Ran · nothing to update', sub: 'Your edit didn’t change when trades fire' });
          return;
        }
        const d = treeDiff(before, r.tree);
        const parts = [d.added && `${d.added} added`, d.changed && `${d.changed} changed`, d.removed && `${d.removed} removed`].filter(Boolean).join(', ') || 'redrawn';
        applying = true;
        C().fromCode(r.tree, { timing: r.timing, codeOnly: r.codeOnly }, 'Updated from your Pine Script');
        applying = false;
        void refreshChart();
        const blocks = d.added + d.changed + d.removed;
        const what = r.codeOnly
          ? 'Canvas shows “Runs from Pine Script” · memory between candles'
          : r.customLines.length
            ? `Canvas updated · ${plural(Math.max(1, blocks - r.customLines.length), 'block')}, ${r.customLines.length} custom logic (line ${r.customLines.join(', ')})`
            : `Canvas and chart updated · ${blocks} block${blocks === 1 ? '' : 's'} changed`;
        if (opts.after) log({ text: opts.after, tone: 'ok' }, true);
        log({ text: opts.after ? 'Compiled · canvas and chart updated' : what, tone: 'ok' }, !opts.after);
        // the canvas says it with </> (you made this change, not Copilot)
        C().showToast(r.codeOnly ? 'Updated from your code · runs from Pine Script' : `Updated from your code · ${parts}`, true, 'code');
        // Undo puts the canvas back; the code then follows the canvas like any canvas change
        if (!opts.quiet) toast({ text: 'Ran · canvas updated', sub: `${blocks} block${blocks === 1 ? '' : 's'} changed`, undo: () => { C().undo(); toast(null); } });
      }, 500);
    },

    // 1A → 1B: one tap, re-runs by itself, green for 2s, Undo for 10s
    fix: (id) => {
      const p = get().problems.find((x) => x.id === id);
      if (!p?.fix) return;
      const beforeCode = get().code;
      const beforeTree = { entry: C().entry, exit: C().exit };
      set({ fixing: id });
      setTimeout(() => {
        const code = replaceLine(get().code, p.line, p.fix!.line);
        const at = p.fix!.line.indexOf(p.fix!.plus.split('=')[0]);
        set({ code, fixing: null, justFixed: { line: p.line, from: Math.max(0, at), to: Math.max(0, at) + p.fix!.plus.split(/[=(]/)[0].length } });
        clearTimeout(fixedTimer);
        fixedTimer = setTimeout(() => set({ justFixed: null }), 2000);
        get().run({ quiet: true, after: `AI fix applied · line ${p.line}` });
        toast({
          text: `Fixed line ${p.line} and re-ran`, sub: 'Compiled · canvas and chart updated',
          undo: () => { applying = true; C().fromCode(beforeTree, {}, 'Undid an AI fix'); applying = false; set({ code: beforeCode, ran: get().ran }); toast(null); },
        }, 10000);
      }, 400);
    },
    ignore: (id) => set((s) => ({ closed: [...s.closed, id] })),
    reopen: (id) => set((s) => ({ closed: s.closed.filter((x) => x !== id), focus: { line: s.problems.find((p) => p.id === id)?.line ?? 1, n: Date.now() } })),
    choose: (id, option) => set((s) => ({ answers: { ...s.answers, [id]: option } })),
    // 1C: the AI never picks a value that changes when trades fire
    applyAnswer: (id) => {
      const p = get().problems.find((x) => x.id === id);
      const o = p?.options?.[get().answers[id] ?? 0];
      if (!p || !o) return;
      if (o.line === null) return set((s) => ({ closed: [...s.closed, id], focus: { line: p.line, n: Date.now() } }));
      set({ fixing: id });
      setTimeout(() => {
        set({ code: replaceLine(get().code, p.line, o.line!), fixing: null });
        get().run({ quiet: true, after: `Applied your choice · line ${p.line}` });
        toast({ text: `Updated line ${p.line} and re-ran`, sub: 'Compiled · canvas and chart updated' }, 10000);
      }, 400);
    },

    // 2B: Fix all always opens the review first; nothing changes until Apply
    startReview: () => set((s) => ({ review: { mode: 'all', selected: s.problems.filter((p) => p.fix || p.options).map((p) => p.id), answers: Object.fromEntries(s.problems.filter((p) => p.options).map((p) => [p.id, 0])) } })),
    toggleReview: (id) => set((s) => (s.review?.mode === 'all' ? { review: { ...s.review, selected: s.review.selected.includes(id) ? s.review.selected.filter((x) => x !== id) : [...s.review.selected, id] } } : {})),
    applyReview: () => {
      const r = get().review;
      if (r?.mode !== 'all') return;
      // bottom to top, so line numbers stay right
      let code = get().code;
      for (const p of [...get().problems].sort((a, b) => b.line - a.line)) {
        if (!r.selected.includes(p.id)) continue;
        const text = p.fix?.line ?? p.options?.[r.answers[p.id] ?? 0]?.line;
        if (text != null) code = replaceLine(code, p.line, text);
      }
      const n = r.selected.length;
      set({ code, review: null });
      get().run({ quiet: true, after: `Applied ${n} AI fix${n > 1 ? 'es' : ''}` });
      toast({ text: `Applied ${n} fixes and re-ran`, sub: 'Compiled · canvas and chart updated' }, 10000);
    },

    // 2C: the 1A card in a bottom sheet; the code runs when you finish
    oneByOne: () => set({ review: { mode: 'one', index: 0, fixed: 0, skipped: [] } }),
    stepOne: (dir) => set((s) => (s.review?.mode === 'one' ? { review: { ...s.review, index: Math.min(Math.max(0, s.review.index + dir), s.problems.length - 1) } } : {})),
    fixOne: () => {
      const r = get().review;
      if (r?.mode !== 'one') return;
      const p = get().problems[r.index];
      const text = p.fix?.line ?? p.options?.[get().answers[p.id] ?? 0]?.line;
      // fixes go in now; line numbers of the others stay put unless lines are added
      if (text != null) set({ code: replaceLine(get().code, p.line, text) });
      const done = r.fixed + 1;
      if (r.index >= get().problems.length - 1) return get().closeReview();
      set({ review: { ...r, index: r.index + 1, fixed: done } });
    },
    skipOne: () => {
      const r = get().review;
      if (r?.mode !== 'one') return;
      if (r.index >= get().problems.length - 1) return get().closeReview();
      set({ review: { ...r, index: r.index + 1, skipped: [...r.skipped, get().problems[r.index].id] } });
    },
    fixRemaining: () => {
      const r = get().review;
      if (r?.mode !== 'one') return;
      let code = get().code;
      const rest = get().problems.slice(r.index).filter((p) => p.fix).sort((a, b) => b.line - a.line);
      for (const p of rest) code = replaceLine(code, p.line, p.fix!.line);
      set({ code });
      get().closeReview();
    },
    closeReview: () => {
      const r = get().review;
      set({ review: null });
      if (r?.mode === 'one' && get().code !== get().ran) get().run({ quiet: true, after: 'Fixed one by one' });
    },

    // 3: valid code, not supported yet: amber, three ways forward
    unsupported: (id, option) => {
      const p = get().problems.find((x) => x.id === id);
      if (!p) return;
      if (option === 2) {
        toast({ text: 'Sent to support', sub: 'We’ll tell you when request.security works in AlgoTest.' });
        return set((s) => ({ closed: [...s.closed, id] }));
      }
      const name = lines(get().code)[p.line - 1].match(/^\s*(\w+)\s*=/)?.[1] ?? '';
      // drop the line and any filter that used it
      let code = replaceLine(get().code, p.line, '');
      code = code.replace(new RegExp(`\\s+and\\s+${name}\\s*[<>]=?\\s*${name}\\[\\d+\\]`), '');
      if (option === 0) code = code.replace(/^(longOk = .*)$/m, '$1 and close > ta.sma(close, 50)');
      set({ code });
      get().run({ quiet: true, after: option === 0 ? 'Rebuilt with AI · BANKNIFTY filter → close above MA 50' : 'Removed line 7' });
    },

    // Discard: back to exactly when you opened the editor (one undo step)
    discard: () => {
      const snap = get().snapshot;
      if (!snap) return;
      const now = state();
      const n = Math.max(1, changeCount(lines(snap.code), lines(now.code)));
      restore(snap, 'Discarded changes from the Pine Script editor');
      toast({ text: `Discarded ${n} change${n > 1 ? 's' : ''}`, sub: 'Back to when you opened the editor', undo: () => { restore(now, 'Brought back the discarded changes'); toast(null); } }, 10000);
    },

    keepMine: () => set((s) => (s.banner?.kind === 'conflict' ? { banner: null, ran: s.banner.canvas } : {})),
    useCanvasVersion: () => set((s) => (s.banner?.kind === 'conflict' ? { banner: null, code: s.banner.canvas, ran: s.banner.canvas } : {})),

    loadExample: (id) => {
      const ex = EXAMPLES.find((e) => e.id === id);
      if (!ex) return;
      set({ code: ex.code, problems: [], review: null, banner: null, aiLines: [] });
      get().run();
    },

    // Copilot changed canvas and code together: violet lines + bar with Undo; the code ran by itself
    copilotChanged: (before, note, undo) => {
      const code = C().codeOnly ? get().ran : canvasCode();
      set({ code, ran: code, aiLines: changedSince(lines(before), lines(code)), aiNote: note, aiUndo: undo, problems: [], banner: null });
    },

    copilotCode: (code, note) => {
      const before = get().ran;
      const r = compile(code, hints());
      if (!r.ok) return;
      applying = true;
      C().fromCode(r.tree, { timing: r.timing, codeOnly: r.codeOnly }, 'Copilot wrote Pine Script');
      applying = false;
      set({ code, ran: code, memoryLines: r.memoryLines, aiLines: changedSince(lines(before), lines(code)), aiNote: note, aiUndo: () => { C().undo(); set({ code: canvasCode(), ran: canvasCode(), aiLines: [] }); }, problems: [], banner: null });
    },

    goTo: (line) => set({ focus: { line, n: Date.now() } }),
    nextProblem: () => {
      const ps = get().problems;
      if (!ps.length) return;
      const cur = get().focus?.line ?? 0;
      const next = ps.find((p) => p.line > cur) ?? ps[0];
      set({ focus: { line: next.line, n: Date.now() } });
    },
    set: (p) => set(p),
  };
});

/** Changes since the editor opened (for Discard: on, and its tooltip). */
export function changesSinceOpen(s: PineState): number {
  if (!s.snapshot) return 0;
  const codeN = changeCount(lines(s.snapshot.code), lines(s.code));
  const treeChanged = !sameTree(s.snapshot.tree, { entry: C().entry, exit: C().exit }) || s.snapshot.codeOnly !== C().codeOnly;
  return codeN || (treeChanged ? 1 : 0);
}

/** "5, 8–12": the lines that hold memory between candles. */
export const memoryText = (s: PineState) => lineRanges(s.memoryLines);

/* ── canvas → code, silently ───────────────────────────────────── */

useCanvas.subscribe((c, prev) => {
  if (applying || c.codeOnly) return;
  if (c.entry === prev.entry && c.exit === prev.exit && c.timing === prev.timing) return;
  const p = usePine.getState();
  const theirs = canvasCode();
  if (theirs === p.ran) return;
  if (p.code === p.ran) {
    // not edited: the code follows the canvas, no bar, no toast, no highlight
    usePine.setState({ code: theirs, ran: theirs, aiLines: [] });
    return;
  }
  // an un-run draft: slot the canvas change in quietly unless the same lines collide
  const m = merge3(lines(p.ran), lines(p.code), lines(theirs));
  if ('lines' in m) usePine.setState({ code: m.lines.join('\n'), ran: theirs });
  else usePine.setState({ banner: { kind: 'conflict', lines: m.conflict, canvas: theirs } });
});
