import { create } from 'zustand';
import { flatConditions, removeNodes, replaceNode } from '@/lib/conditions';
import { changedCount, changedSince, patchCode } from '@/lib/lineDiff';
import { pineText } from '@/lib/pine';
import { reconcile } from '@/lib/pineMap';
import { compile, findProblems, sameTree, treeDiff, type Problem } from '@/lib/pineParse';
import { EXAMPLES } from '@/mock/pine';
import type { StrategyTree } from '@/types/strategy';
import { useCanvas } from './canvas';
import { useStrategy } from './strategy';
import { useWorkspace } from './workspace';

/*
  Pine Script editor store (design/pine-editor/COMPONENTS.md v2 · 0 The model).
  Two things, never mixed up:
    • draft (`code`): the text in the editor right now; it can be half-typed or broken
    • last run (`ran`): the last code that compiled; canvas, chart and backtest only show this
  Who changes what:
    • canvas by hand → its lines are patched into draft and last run, silently (names, comments,
      spacing stay; the caret never moves)
    • typing → only the draft. Run compiles all of it: canvas redraws, changed blocks glow once,
      chart refreshes, backtest goes out of date. Errors → nothing commits.
    • Copilot from the Ask box → a text edit (⌘Z takes it back), then it runs; violet gutter marks
    • Copilot from Chat → patched in like the canvas, violet marks; Undo lives in its chat card
    • Discard → the draft goes back to the last run, as one ⌘Z step. No confirm, no toast.
  No bars or toasts: the status line says everything. Drafts are kept per strategy.
*/

export interface LogLine {
  id: number;
  time: string;
  text: string;
  tone: 'ok' | 'error' | 'needs' | 'muted';
  tag?: string;
  problemId?: string;
}

/** What the last run said, for the status line. */
export interface LastRun {
  at: string; // "16:04"
  detail: string | null; // "1 block changed", "nothing to update", "fixed line 15", "Copilot changed 2 lines"…
}

type Review =
  | { mode: 'all'; selected: string[]; answers: Record<string, number> }
  | { mode: 'one'; index: number; fixed: number };

/** How the last code change came in, so the editor knows whether ⌘Z should take it back. */
export type CodeSource = 'type' | 'local' | 'external';

interface Draft {
  code: string;
  ran: string;
  at: string;
}

interface PineState {
  open: boolean;
  code: string;
  ran: string;
  /** bumps with every change the store makes to `code` (not your typing) */
  rev: number;
  source: CodeSource;
  running: boolean;
  /** Copilot is writing into the draft (about 1s; the editor is read-only) */
  copilotEditing: boolean;
  problems: Problem[];
  /** fix cards open after Run; the live check while typing only draws squiggles */
  cardsOpen: boolean;
  fixing: string | null;
  closed: string[];
  answers: Record<string, number>;
  review: Review | null;
  justFixed: { line: number; from: number; to: number } | null;
  /** lines Copilot changed (violet gutter marks, until you edit them) */
  aiLines: number[];
  conflict: null | { lines: [number, number]; canvas: string; canvasRan: string };
  log: LogLine[];
  logOpen: boolean;
  lastRun: LastRun;
  /** coming back to code that hadn't run: "Draft from 16:10 · not run" */
  draftFrom: string | null;
  /** un-run drafts, per strategy (the toggle and the My Strategies row show a blue dot) */
  drafts: Record<string, Draft>;
  strategyKey: string;
  memoryLines: number[];
  customCount: number;
  /** `quiet`: move the caret without taking focus (Find keeps its field) */
  focus: { line: number; n: number; quiet?: boolean } | null;
  /** lines tied to the block you clicked on the canvas */
  linked: number[];
  /** ⌘L: the selected lines, as a chip in the Ask box */
  askChip: { from: number; to: number } | null;
  /** an Ask-box request is on its way: its change is a text edit you can ⌘Z */
  asking: boolean;
  caret: { line: number; col: number };

  openEditor: (line?: number) => void;
  closeEditor: () => void;
  type: (code: string) => void;
  run: (opts?: { after?: string; detail?: string }) => void;
  fix: (id: string) => void;
  ignore: (id: string) => void;
  reopen: (id: string) => void;
  choose: (id: string, option: number) => void;
  applyAnswer: (id: string) => void;
  startReview: () => void;
  toggleReview: (id: string) => void;
  answerReview: (id: string, option: number) => void;
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
  ask: () => void;
  copilotChanged: (before: string, note: string) => void;
  copilotCode: (code: string, note: string) => void;
  switchStrategy: (key: string) => void;
  goTo: (line: number, quiet?: boolean) => void;
  nextProblem: () => void;
  set: (p: Partial<PineState>) => void;
}

/* ── helpers ───────────────────────────────────────────────────── */

const C = () => useCanvas.getState();
const lines = (s: string) => s.split('\n');
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
let logId = 0;
let fixedTimer: ReturnType<typeof setTimeout> | undefined;
let checkTimer: ReturnType<typeof setTimeout> | undefined;
/** true while Run (or Discard of a run) writes to the canvas, so canvas → code doesn't answer itself */
let applying = false;

const nameNow = () => useStrategy.getState().name ?? 'Untitled strategy';
const treeNow = (): StrategyTree => ({ entry: C().entry, exit: C().exit });
/** The code the canvas writes for a tree. */
export const codeFor = (t: StrategyTree) => pineText(t, nameNow(), { timing: C().timing });
export const canvasCode = () => codeFor(treeNow());

function hints() {
  const lengths: Record<string, number> = {};
  for (const c of [...flatConditions(C().entry), ...flatConditions(C().exit)])
    for (const o of [c.left, c.right])
      if (o?.type === 'indicator' && o.params.length) lengths[`${o.id}${o.params.length}`] = o.params.length;
  return { lengths };
}

async function refreshChart() {
  const { countsNow } = await import('./copilot');
  useWorkspace.getState().updateChart(countsNow());
}

/** Lines of the draft that haven't run. */
export const unrunLines = (s: { code: string; ran: string }) => (s.code === s.ran ? 0 : Math.max(1, changedCount(s.ran, s.code)));

export const usePine = create<PineState>((set, get) => {
  const log = (l: Omit<LogLine, 'id' | 'time'>, replace = false) =>
    set((s) => ({ log: [...(replace ? [] : s.log.slice(-5)), { ...l, id: ++logId, time: stamp() }] }));
  /** a change the store makes to the draft; `local` ones are on the editor's undo stack */
  const write = (code: string, source: CodeSource, extra: Partial<PineState> = {}) => set((s) => ({ code, source, rev: s.rev + 1, ...extra }));
  const replaceLine = (code: string, line: number, text: string) => {
    const ls = lines(code);
    if (text === '') ls.splice(line - 1, 1);
    else ls.splice(line - 1, 1, ...text.split('\n'));
    return ls.join('\n');
  };

  return {
    open: false,
    code: '',
    ran: '',
    rev: 0,
    source: 'external',
    running: false,
    copilotEditing: false,
    problems: [],
    cardsOpen: false,
    fixing: null,
    closed: [],
    answers: {},
    review: null,
    justFixed: null,
    aiLines: [],
    conflict: null,
    log: [],
    logOpen: true,
    lastRun: { at: clock(), detail: null },
    draftFrom: null,
    drafts: {},
    strategyKey: 'none',
    memoryLines: [],
    customCount: 0,
    focus: null,
    linked: [],
    askChip: null,
    asking: false,
    caret: { line: 1, col: 1 },

    openEditor: (line) => {
      const s = get();
      const ran = s.ran || canvasCode();
      set({ open: true, ran, code: s.code || ran, focus: line ? { line, n: Date.now() } : s.focus });
    },
    // the draft is kept for this strategy; the toggle shows a dot
    closeEditor: () =>
      set((s) => {
        const drafts = { ...s.drafts };
        if (s.code !== s.ran) drafts[s.strategyKey] = { code: s.code, ran: s.ran, at: s.draftFrom ?? clock() };
        else delete drafts[s.strategyKey];
        return { open: false, review: null, drafts, draftFrom: s.code !== s.ran ? (s.draftFrom ?? clock()) : null };
      }),

    type: (code) => {
      // your edit takes Copilot's violet mark off the lines you touched
      const ai = get().aiLines.filter((l) => lines(get().code)[l - 1] === lines(code)[l - 1]);
      set({ code, source: 'type', cardsOpen: false, review: null, aiLines: ai, draftFrom: null, justFixed: null });
      // live check 600ms after typing stops: squiggles and the count only, no cards
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        const s = get();
        if (s.code === s.ran) return set({ problems: [] });
        set({ problems: findProblems(s.code, hints()), closed: [] });
      }, 600);
    },

    run: (opts = {}) => {
      const code = get().code;
      clearTimeout(checkTimer);
      set({ running: true, review: null });
      log({ text: 'Compiling…', tone: 'muted' }, true);
      setTimeout(() => {
        const r = compile(code, hints());
        if (!r.ok) {
          // nothing commits; the first error opens its AI fix card
          set({ running: false, problems: r.problems, cardsOpen: true, closed: [], answers: {}, logOpen: r.problems.length < 3, log: [] });
          for (const p of r.problems.slice(0, 3))
            log({ text: p.message, tone: p.kind === 'needs' || p.kind === 'unsupported' ? 'needs' : 'error', tag: `Error ${p.line}:${p.col}`, problemId: p.id });
          set({ focus: { line: r.problems[0].line, n: Date.now() } });
          return;
        }
        const before = treeNow();
        const nothing = !r.codeOnly && !C().codeOnly && sameTree(before, r.tree);
        const drafts = { ...get().drafts };
        delete drafts[get().strategyKey];
        set({ running: false, problems: [], cardsOpen: false, ran: code, memoryLines: r.memoryLines, customCount: r.customLines.length, conflict: null, draftFrom: null, drafts });
        if (nothing) {
          if (opts.after) log({ text: opts.after, tone: 'ok' }, true);
          log({ text: 'Compiled · nothing to update', tone: 'ok' }, !opts.after);
          set({ lastRun: { at: clock(), detail: opts.detail ?? 'nothing to update' } });
          return;
        }
        const d = treeDiff(before, r.tree);
        const blocks = d.added + d.changed + d.removed;
        // unchanged blocks keep their ids; the changed ones glow once (no toast)
        const { tree, changed } = reconcile(before, r.tree);
        applying = true;
        C().fromCode(tree, { timing: r.timing, codeOnly: r.codeOnly }, 'Ran Pine Script');
        applying = false;
        C().glowOnce(changed);
        void refreshChart();
        const what = r.codeOnly
          ? 'Canvas shows “Runs from Pine Script” · memory between candles'
          : r.customLines.length
            ? `Canvas updated · ${plural(Math.max(1, blocks - r.customLines.length), 'block')}, ${r.customLines.length} custom logic (line ${r.customLines.join(', ')})`
            : `Canvas and chart updated · ${plural(blocks, 'block')} changed`;
        if (opts.after) log({ text: opts.after, tone: 'ok' }, true);
        else log({ text: 'Compiled.', tone: 'muted' }, true);
        log({ text: what, tone: 'ok' });
        set({ lastRun: { at: clock(), detail: opts.detail ?? (r.codeOnly ? 'runs from code' : r.customLines.length ? plural(r.customLines.length, 'custom block') : `${plural(blocks, 'block')} changed`) } });
      }, 500);
    },

    // Fix & run: a normal text edit (⌘Z undoes it), then a run. Green line for 2s. No toast.
    fix: (id) => {
      const p = get().problems.find((x) => x.id === id);
      if (!p?.fix) return;
      set({ fixing: id });
      setTimeout(() => {
        const code = replaceLine(get().code, p.line, p.fix!.line);
        const tok = p.fix!.plus.split(/[=(]/)[0];
        const at = p.fix!.line.indexOf(tok);
        write(code, 'local', { fixing: null, justFixed: { line: p.line, from: Math.max(0, at), to: Math.max(0, at) + tok.length } });
        clearTimeout(fixedTimer);
        fixedTimer = setTimeout(() => set({ justFixed: null }), 2000);
        get().run({ after: `AI fix applied · line ${p.line}`, detail: `fixed line ${p.line}` });
      }, 400);
    },
    ignore: (id) => set((s) => ({ closed: [...s.closed, id] })),
    reopen: (id) => set((s) => ({ closed: s.closed.filter((x) => x !== id), cardsOpen: true, focus: { line: s.problems.find((p) => p.id === id)?.line ?? 1, n: Date.now() } })),
    choose: (id, option) => set((s) => ({ answers: { ...s.answers, [id]: option } })),
    applyAnswer: (id) => {
      const p = get().problems.find((x) => x.id === id);
      const o = p?.options?.[get().answers[id] ?? 0];
      if (!p || !o) return;
      if (o.line === null) return set((s) => ({ closed: [...s.closed, id], focus: { line: p.line, n: Date.now() } }));
      set({ fixing: id });
      setTimeout(() => {
        write(replaceLine(get().code, p.line, o.line!), 'local', { fixing: null });
        get().run({ after: `Applied your choice · line ${p.line}`, detail: `fixed line ${p.line}` });
      }, 400);
    },

    startReview: () => set((s) => ({ review: { mode: 'all', selected: s.problems.filter((p) => p.fix).map((p) => p.id), answers: {} } })),
    toggleReview: (id) => set((s) => (s.review?.mode === 'all' ? { review: { ...s.review, selected: s.review.selected.includes(id) ? s.review.selected.filter((x) => x !== id) : [...s.review.selected, id] } } : {})),
    answerReview: (id, option) => set((s) => (s.review?.mode === 'all' ? { review: { ...s.review, answers: { ...s.review.answers, [id]: option }, selected: s.review.selected.includes(id) ? s.review.selected : [...s.review.selected, id] } } : {})),
    applyReview: () => {
      const r = get().review;
      if (r?.mode !== 'all') return;
      let code = get().code;
      for (const p of [...get().problems].sort((a, b) => b.line - a.line)) {
        if (!r.selected.includes(p.id)) continue;
        const text = p.fix?.line ?? p.options?.[r.answers[p.id] ?? 0]?.line;
        if (text != null) code = replaceLine(code, p.line, text);
      }
      const n = r.selected.length;
      write(code, 'local', { review: null });
      get().run({ after: `Applied ${plural(n, 'AI fix')}`.replace('fixs', 'fixes'), detail: `fixed ${plural(n, 'line')}` });
    },

    oneByOne: () => set({ review: { mode: 'one', index: 0, fixed: 0 } }),
    stepOne: (dir) => set((s) => (s.review?.mode === 'one' ? { review: { ...s.review, index: Math.min(Math.max(0, s.review.index + dir), s.problems.length - 1) } } : {})),
    fixOne: () => {
      const r = get().review;
      if (r?.mode !== 'one') return;
      const p = get().problems[r.index];
      const text = p.fix?.line ?? p.options?.[get().answers[p.id] ?? 0]?.line;
      if (text != null) write(replaceLine(get().code, p.line, text), 'local');
      if (r.index >= get().problems.length - 1) return get().closeReview();
      set({ review: { ...r, index: r.index + 1, fixed: r.fixed + 1 } });
    },
    skipOne: () => {
      const r = get().review;
      if (r?.mode !== 'one') return;
      if (r.index >= get().problems.length - 1) return get().closeReview();
      set({ review: { ...r, index: r.index + 1 } });
    },
    fixRemaining: () => {
      const r = get().review;
      if (r?.mode !== 'one') return;
      let code = get().code;
      for (const p of get().problems.slice(r.index).filter((x) => x.fix).sort((a, b) => b.line - a.line)) code = replaceLine(code, p.line, p.fix!.line);
      write(code, 'local');
      get().closeReview();
    },
    // the code runs when you finish
    closeReview: () => {
      const r = get().review;
      set({ review: null });
      if (r?.mode === 'one' && get().code !== get().ran) get().run({ after: 'Fixed one by one' });
    },

    // Not supported: amber, three ways forward
    unsupported: (id, option) => {
      const p = get().problems.find((x) => x.id === id);
      if (!p) return;
      if (option === 2) {
        log({ text: 'Sent your code to support. We’ll tell you when request.security works.', tone: 'ok' });
        return set((s) => ({ closed: [...s.closed, id] }));
      }
      const name = lines(get().code)[p.line - 1].match(/^\s*(\w+)\s*=/)?.[1] ?? '';
      let code = replaceLine(get().code, p.line, '');
      code = code.replace(new RegExp(`\\s+and\\s+${name}\\s*[<>]=?\\s*${name}\\[\\d+\\]`), '');
      if (option === 0) code = code.replace(/^(longOk = .*)$/m, '$1 and close > ta.sma(close, 50)');
      write(code, 'local');
      get().run({ after: option === 0 ? 'Rebuilt with AI · BANKNIFTY filter → close above MA 50' : `Removed line ${p.line}` });
    },

    // throw away what hasn't run: one step on the editor's undo stack, nothing else moves
    discard: () => {
      const s = get();
      if (s.code === s.ran) return;
      const drafts = { ...s.drafts };
      delete drafts[s.strategyKey];
      write(s.ran, 'local', { problems: [], cardsOpen: false, review: null, conflict: null, draftFrom: null, drafts });
    },

    keepMine: () => set((s) => (s.conflict ? { conflict: null, ran: s.conflict.canvasRan } : {})),
    useCanvasVersion: () => {
      const c = get().conflict;
      if (c) write(c.canvas, 'local', { conflict: null, ran: c.canvasRan });
    },

    // replaces the draft as one undo step; Run when you're ready
    loadExample: (id) => {
      const ex = EXAMPLES.find((e) => e.id === id);
      if (!ex) return;
      write(ex.code, 'local', { problems: findProblems(ex.code, hints()), cardsOpen: false, review: null, conflict: null, aiLines: [], draftFrom: null, closed: [] });
    },

    // the Ask box: Copilot is writing (read-only for about a second)
    ask: () => set({ asking: true, copilotEditing: true }),

    // Copilot changed canvas and code together: violet gutter marks; the status line says so
    copilotChanged: (before, note) => {
      const s = get();
      const after = s.code;
      const ai = changedSince(lines(before), lines(after));
      if (s.asking) log({ text: `Copilot ${note} · ran · canvas updated`, tone: 'ok' }, true);
      set({ aiLines: ai, asking: false, copilotEditing: false, problems: [], lastRun: { at: clock(), detail: `Copilot changed ${plural(ai.length, 'line')}` } });
    },
    copilotCode: (code, note) => {
      const before = get().ran;
      const r = compile(code, hints());
      if (!r.ok) return;
      applying = true;
      C().fromCode(r.tree, { timing: r.timing, codeOnly: r.codeOnly }, 'Copilot wrote Pine Script');
      applying = false;
      write(code, get().asking ? 'local' : 'external', { ran: code, memoryLines: r.memoryLines });
      get().copilotChanged(before, note);
      set({ lastRun: { at: clock(), detail: 'runs from code' } });
    },

    // the builder opened another strategy: keep this one's draft, bring back that one's
    switchStrategy: (key) => {
      const s = get();
      const drafts = { ...s.drafts };
      if (s.code !== s.ran && s.code) drafts[s.strategyKey] = { code: s.code, ran: s.ran, at: s.draftFrom ?? clock() };
      const d = drafts[key];
      set({ strategyKey: key, drafts, aiLines: [], problems: [], review: null, conflict: null, log: [], memoryLines: [], customCount: 0 });
      if (d) write(d.code, 'external', { ran: d.ran, draftFrom: d.at });
      else write(canvasCode(), 'external', { ran: canvasCode(), draftFrom: null });
    },

    goTo: (line, quiet) => set({ focus: { line, n: Date.now(), quiet } }),
    nextProblem: () => {
      const ps = get().problems;
      if (!ps.length) return;
      const cur = get().caret.line;
      const next = ps.find((p) => p.line > cur) ?? ps[0];
      set({ focus: { line: next.line, n: Date.now() }, cardsOpen: true });
    },
    set: (p) => set(p),
  };
});

/** What Copilot wants to change in lines you typed: shown in place, waits for Apply. */
export function pendingPatch(): string | null {
  const p = C().pending;
  if (!p) return null;
  let next = treeNow();
  for (const [id, c] of Object.entries(p.changes)) next = replaceNode(next, id, c);
  if (p.removals.length) next = removeNodes(next, p.removals);
  return patchCode(canvasCode(), usePine.getState().code, codeFor(next));
}

/* ── canvas → code: patch only that block's lines, silently ────── */

useCanvas.subscribe((c, prev) => {
  if (applying || c.codeOnly) return;
  if (c.entry === prev.entry && c.exit === prev.exit && c.timing === prev.timing) return;
  const p = usePine.getState();
  const was = codeFor({ entry: prev.entry, exit: prev.exit });
  const now = codeFor({ entry: c.entry, exit: c.exit });
  if (was === now) return;
  // last run follows the canvas (the canvas always shows the last run)
  const ran = patchCode(was, p.ran || was, now) ?? now;
  const source: CodeSource = p.asking ? 'local' : 'external';
  // the status stays "In sync" (no detail about the last run any more)
  const lastRun = { at: p.lastRun.at, detail: p.asking ? p.lastRun.detail : null };
  if (p.code === p.ran) {
    usePine.setState((s) => ({ code: ran, ran, source, rev: s.rev + 1, lastRun }));
    return;
  }
  // an un-run draft: slot the canvas change in quietly, unless it lands on lines you're editing
  const code = patchCode(was, p.code, now);
  if (code !== null) usePine.setState((s) => ({ code, ran, source, rev: s.rev + 1, lastRun }));
  else {
    const at = changedSince(lines(p.ran), lines(p.code));
    const span: [number, number] = [at[0] ?? 1, at.at(-1) ?? at[0] ?? 1];
    usePine.setState({ conflict: { lines: span, canvas: now, canvasRan: ran } });
  }
});
