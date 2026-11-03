import { create } from 'zustand';
import { findNode, flatConditions, removeNodes, replaceNode, uid } from '@/lib/conditions';
import { pineFor } from '@/lib/pine';
import { computeSignals } from '@/lib/signals';
import { generateSeries } from '@/mock/candles';
import {
  EXIT_OPTIONS, mainEntry, mainExit, matchScript, partlyFitsEntry, rsiExit, simplifiedEntry, TIMING, VAGUE_OPTIONS, volumeFilter, vwapEntry, WHY_ANSWER,
} from '@/mock/copilot';
import type { Condition, Side } from '@/types/strategy';
import { useBacktest } from './backtest';
import { useCanvas } from './canvas';
import { useStrategy } from './strategy';
import { useWorkspace } from './workspace';

/*
  Copilot store (design/copilot). One AI card per request; it changes state IN PLACE:
    Understood (+ one question) → Building → Applied → Strategy ready.
  Adding goes straight onto the canvas with Undo. Changing or removing blocks YOU made
  is previewed first and waits for Apply. Fit is decided before anything is placed.
  Everything is scripted (mock/copilot.ts); timings are faked.
*/

export interface Counts {
  entries: number;
  exits: number;
}

export type Card =
  | {
      kind: 'main';
      id: string;
      phase: 'thinking' | 'understood' | 'building' | 'applied' | 'ready' | 'stopped';
      entry: Condition[];
      exit: Condition | null;
      exitNote?: string;
      question: { chosen: number | null } | null;
      placed: number;
      counts: Counts | null;
      mark: number; // canvas history length before this card added anything
    }
  | { kind: 'refineAdd'; id: string; added: Condition; before: Counts; after: Counts; mark: number }
  | { kind: 'review'; id: string; phase: 'pending' | 'applied' | 'cancelled'; change: { id: string; from: number; to: number } | null; removal: Condition | null; before: number; after: number; mark: number }
  | { kind: 'fit'; id: string; phase: 'check' | 'built' | 'simplified'; counts: Counts | null; mark: number }
  | { kind: 'codeOnly'; id: string }
  | { kind: 'failed'; id: string; phase: 'thinking' | 'failed' | 'skipped'; detailsOpen: boolean; mark: number; entryCount: number }
  | { kind: 'vague'; id: string; chosen: number | null }
  | { kind: 'note'; id: string; text: string };

export type Message = { kind: 'user'; id: string; text: string } | { kind: 'card'; id: string; card: Card };

interface CopilotState {
  messages: Message[];
  view: 'chat' | 'pine';
  /** the code as it was before Copilot's last change; null = in sync */
  pineBase: string[] | null;
  pineNote: string;
  focusLine: number | null;
  listening: boolean;

  send: (text: string) => void;
  answer: (cardId: string, option: number) => void;
  stop: () => void;
  resume: (cardId: string) => void;
  undo: (cardId: string) => void;
  applyReview: (cardId: string) => void;
  cancelReview: (cardId: string) => void;
  buildAnyway: (cardId: string) => void;
  simplify: (cardId: string) => void;
  retryFailed: (cardId: string) => void;
  skipExit: (cardId: string) => void;
  addExitOnCanvas: () => void;
  toggleDetails: (cardId: string) => void;
  pickVague: (cardId: string, option: number) => void;
  checkOnChart: () => void;
  runBacktest: () => void;
  setView: (v: 'chat' | 'pine') => void;
  openLine: (line: number) => void;
  discardCode: () => void;
  applyCode: () => void;
  newChat: () => void;
  set: (p: Partial<CopilotState>) => void;
}

/* ── helpers ───────────────────────────────────────────────────── */

const C = () => useCanvas.getState();
const tree = () => ({ entry: C().entry, exit: C().exit });
let timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
const stopTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

/** Signals from the seeded engine, for what's on the canvas right now. */
export function countsNow(): Counts {
  const w = useWorkspace.getState();
  const candles = generateSeries(w.instrument, w.timeframe, w.chartData, w.period);
  const r = computeSignals(candles, w.limits, tree());
  return { entries: r.entries, exits: r.exits };
}

const strategyName = () => useStrategy.getState().name ?? 'Untitled strategy';
const pineNow = () => pineFor(tree(), strategyName(), { codeOnly: C().codeOnly });
/** Empty both sections as one undoable step. */
const clearCanvas = () => {
  C().set({ codeOnly: false });
  if (!flatConditions(C().entry).length && !flatConditions(C().exit).length) return;
  C().copilotCommit({ entry: { ...C().entry, children: [] }, exit: { ...C().exit, children: [] } }, 'Copilot started a new strategy');
};
const findCond = (pred: (c: Condition) => boolean) => [...flatConditions(C().entry), ...flatConditions(C().exit)].find(pred);

export const useCopilot = create<CopilotState>((set, get) => {
  const add = (m: Message) => set((s) => ({ messages: [...s.messages, m] }));
  const card = (c: Card) => add({ kind: 'card', id: c.id, card: c });
  const patch = (id: string, p: Partial<Card>) =>
    set((s) => ({ messages: s.messages.map((m) => (m.kind === 'card' && m.id === id ? { ...m, card: { ...m.card, ...p } as Card } : m)) }));
  const cardOf = (id: string) => get().messages.find((m): m is Extract<Message, { kind: 'card' }> => m.kind === 'card' && m.id === id)?.card;
  /** remember the code just before a Copilot change, so the Pine view can highlight what it changed */
  const markPine = (note: string) => set({ pineBase: pineNow(), pineNote: note });

  /** Place conditions one by one (ghosts), then commit them as one step (one Undo). */
  const build = (cardId: string, side: Side, conds: Condition[], from: number, done: () => void) => {
    const show = (i: number) =>
      C().set({
        copilotPreview: {
          side,
          rows: conds.map((c, j) => (j < i ? { kind: 'ghost' as const, cond: c } : j === i ? { kind: 'ghost' as const, cond: c } : { kind: 'skeleton' as const })),
          placeholder: C().copilotPreview?.placeholder ?? null,
        },
      });
    const step = (i: number) => {
      if (i >= conds.length) {
        markPine(side === 'entry' ? 'entry conditions' : 'exit');
        const placeholder = C().copilotPreview?.placeholder ?? null;
        C().copilotAdd(side, conds.slice(from), `Copilot added ${conds.length - from} ${side} condition${conds.length - from > 1 ? 's' : ''}`);
        C().set({ copilotPreview: placeholder ? { side: placeholder, rows: [], placeholder } : null });
        C().showToast(`Added ${conds.length - from} ${side} condition${conds.length - from > 1 ? 's' : ''}`);
        done();
        return;
      }
      show(i);
      patch(cardId, { placed: i } as Partial<Card>);
      later(TIMING.place, () => step(i + 1));
    };
    step(from);
  };

  /** The main flow: understood (+ exit question) → building → applied → strategy ready. */
  const runMain = (entry: Condition[]) => {
    const id = uid('card');
    const mark = C().history.length;
    card({ kind: 'main', id, phase: 'thinking', entry, exit: null, question: { chosen: null }, placed: 0, counts: null, mark });
    useStrategy.setState({ mode: 'build' });
    later(TIMING.understood, () => {
      // entry is clear, so it's queued; the exit isn't, so Copilot asks once
      patch(id, { phase: 'understood' } as Partial<Card>);
      clearCanvas(); // a new idea is a new strategy (Undo brings the old blocks back)
      C().set({ copilotPreview: { side: 'entry', rows: entry.map(() => ({ kind: 'skeleton' as const })), placeholder: 'exit' }, codeOnly: false });
      later(TIMING.understood, () => {
        patch(id, { phase: 'building' } as Partial<Card>);
        build(id, 'entry', entry, 0, () => {
          const c = cardOf(id);
          if (c?.kind !== 'main') return;
          const counts = countsNow();
          // the exit may already be answered while the entry was building
          if (c.question?.chosen != null) finishExit(id, c.question.chosen);
          else patch(id, { phase: 'applied', placed: entry.length, counts } as Partial<Card>);
        });
      });
    });
  };

  const finishExit = (id: string, option: number) => {
    const c = cardOf(id);
    if (c?.kind !== 'main') return;
    if (option === 0) {
      const exit = mainExit();
      patch(id, { exit, phase: 'building', placed: 0 } as Partial<Card>);
      C().set({ copilotPreview: { side: 'exit', rows: [{ kind: 'ghost', cond: exit }], placeholder: null } });
      later(TIMING.place, () => {
        markPine('exit');
        C().copilotAdd('exit', [exit], 'Copilot added the exit');
        C().set({ copilotPreview: null });
        C().showToast('Added the exit');
        patch(id, { phase: 'ready', placed: c.entry.length, counts: countsNow() } as Partial<Card>);
      });
    } else {
      C().set({ copilotPreview: null });
      patch(id, {
        phase: 'ready',
        placed: c.entry.length,
        counts: countsNow(),
        exitNote: option === 1 ? 'Exits at 15:15 (the setup’s square-off time)' : 'Add your exit on the canvas',
      } as Partial<Card>);
      if (option === 2) C().addCondition('exit');
    }
  };

  return {
    messages: [],
    view: 'chat',
    pineBase: null,
    pineNote: '',
    focusLine: null,
    listening: false,

    send: (raw) => {
      const text = raw.trim();
      if (!text) return;
      // an open question takes the typed answer
      const open = [...get().messages].reverse().find((m) => m.kind === 'card' && m.card.kind === 'main' && m.card.question && m.card.question.chosen === null && m.card.phase !== 'thinking');
      if (open && open.kind === 'card') {
        add({ kind: 'user', id: uid('u'), text });
        const t = text.toLowerCase();
        return get().answer(open.id, /15:15|time|3:15/.test(t) ? 1 : /canvas|myself|i'll/.test(t) ? 2 : 0);
      }
      add({ kind: 'user', id: uid('u'), text });
      set({ view: 'chat' });
      const m = matchScript(text);
      const id = uid('card');
      switch (m.id) {
        case 'why':
          return later(TIMING.understood, () => card({ kind: 'note', id, text: WHY_ANSWER }));
        case 'main':
          return runMain((m.entry ?? mainEntry)());
        case 'refineAdd': {
          const before = countsNow();
          const added = volumeFilter();
          later(TIMING.understood, () => {
            const mark = C().history.length;
            markPine('volume filter');
            C().copilotAdd('entry', [added], 'Copilot added a volume filter to Entry');
            C().showToast('Added 1 condition to Entry');
            card({ kind: 'refineAdd', id, added: findCond((c) => c.left?.type === 'indicator' && c.left.id === 'volume') ?? added, before, after: countsNow(), mark });
          });
          return;
        }
        case 'review': {
          const rsi = findCond((c) => c.left?.type === 'indicator' && c.left.id === 'rsi' && c.right?.type === 'number' && (c.relation === 'Greater Than' || c.relation === 'Greater Than or Equal'));
          const vol = findCond((c) => c.left?.type === 'indicator' && c.left.id === 'volume');
          if (!rsi && !vol) return later(TIMING.understood, () => card({ kind: 'note', id, text: 'There’s no RSI threshold or volume filter on the canvas to change yet. Describe the strategy first, and I’ll build it.' }));
          const before = countsNow().entries;
          // what the canvas would give after the change (worked out, not applied)
          let next = tree();
          if (rsi && rsi.right?.type === 'number') next = replaceNode(next, rsi.id, { ...rsi, right: { ...rsi.right, value: 60 } });
          if (vol) next = removeNodes(next, [vol.id]);
          const w = useWorkspace.getState();
          const after = computeSignals(generateSeries(w.instrument, w.timeframe, w.chartData, w.period), w.limits, next).entries;
          later(TIMING.understood, () => {
            C().set({ pending: { changes: rsi && rsi.right?.type === 'number' ? { [rsi.id]: { ...rsi, right: { ...rsi.right, value: 60 } } } : {}, removals: vol ? [vol.id] : [] } });
            card({ kind: 'review', id, phase: 'pending', change: rsi && rsi.right?.type === 'number' ? { id: rsi.id, from: rsi.right.value, to: 60 } : null, removal: vol ?? null, before, after, mark: C().history.length });
          });
          return;
        }
        case 'partlyFits':
          return later(TIMING.understood, () => card({ kind: 'fit', id, phase: 'check', counts: null, mark: C().history.length }));
        case 'codeOnly':
          return later(TIMING.understood, () => {
            markPine('runs from code');
            C().set({ codeOnly: true, copilotPreview: null });
            card({ kind: 'codeOnly', id });
          });
        case 'failed': {
          const mark = C().history.length;
          card({ kind: 'failed', id, phase: 'thinking', detailsOpen: false, mark, entryCount: 3 });
          later(TIMING.understood, () => {
            clearCanvas();
            C().set({ copilotPreview: { side: 'entry', rows: vwapEntry().map(() => ({ kind: 'skeleton' as const })), placeholder: null } });
            build(id, 'entry', vwapEntry(), 0, () => patch(id, { phase: 'failed' } as Partial<Card>)); // retries happen silently; only the final failure shows
          });
          return;
        }
        case 'vague':
          return later(TIMING.understood, () => card({ kind: 'vague', id, chosen: null }));
      }
    },

    answer: (id, option) => {
      const c = cardOf(id);
      if (c?.kind !== 'main' || !c.question || c.question.chosen !== null) return;
      patch(id, { question: { chosen: option } } as Partial<Card>);
      if (c.phase === 'applied') finishExit(id, option);
    },

    // Stop keeps what's placed
    stop: () => {
      stopTimers();
      const c = [...get().messages].reverse().find((m) => m.kind === 'card' && m.card.kind === 'main' && m.card.phase === 'building');
      const prev = C().copilotPreview;
      if (c && c.kind === 'card' && c.card.kind === 'main') {
        const placed = Math.max(1, c.card.placed);
        const side = prev?.side ?? 'entry';
        const list = side === 'entry' ? c.card.entry : c.card.exit ? [c.card.exit] : [];
        if (placed && list.length) {
          C().copilotAdd(side, list.slice(0, placed), 'Copilot added part of the entry (stopped)');
        }
        C().set({ copilotPreview: null });
        patch(c.id, { phase: 'stopped', placed } as Partial<Card>);
      } else C().set({ copilotPreview: null });
    },
    resume: (id) => {
      const c = cardOf(id);
      if (c?.kind !== 'main') return;
      patch(id, { phase: 'building' } as Partial<Card>);
      build(id, 'entry', c.entry, c.placed, () => patch(id, { phase: 'applied', placed: c.entry.length, counts: countsNow() } as Partial<Card>));
    },
    // Undo: back to how the canvas was before this card
    undo: (id) => {
      const c = cardOf(id);
      if (!c || !('mark' in c)) return;
      while (C().history.length > c.mark) C().undo();
      C().set({ copilotPreview: null, pending: null, toast: null });
      set({ pineBase: null });
      add({ kind: 'card', id: uid('card'), card: { kind: 'note', id: uid('n'), text: 'Undone. The canvas is back to how it was.' } });
    },

    applyReview: (id) => {
      const c = cardOf(id);
      if (c?.kind !== 'review') return;
      let next = tree();
      if (c.change) {
        const node = findNode(next.entry, c.change.id) ?? findNode(next.exit, c.change.id);
        if (node?.kind === 'cond' && node.right?.type === 'number') next = replaceNode(next, node.id, { ...node, right: { ...node.right, value: c.change.to }, copilot: true });
      }
      if (c.removal) next = removeNodes(next, [c.removal.id]);
      markPine('stricter RSI, volume filter removed');
      C().copilotCommit(next, 'Copilot applied 2 changes', 'Applied 2 changes');
      patch(id, { phase: 'applied' } as Partial<Card>);
    },
    cancelReview: (id) => {
      C().set({ pending: null });
      patch(id, { phase: 'cancelled' } as Partial<Card>);
    },

    // Partly fits → one Custom logic block that runs on code
    buildAnyway: (id) => {
      const mark = C().history.length;
      clearCanvas(); // a new strategy, as one step (Undo brings the old one back)
      const line = 5; // where pineFor() writes it: after the version, title and the RSI line
      markPine('custom logic');
      C().copilotAdd('entry', partlyFitsEntry(line), 'Copilot added a custom logic entry', 1);
      C().copilotAdd('exit', [rsiExit()], 'Copilot added the exit', 0);
      C().showToast('Added to canvas · 1 custom block');
      // the custom block runs on code, so the counts are the board's
      patch(id, { phase: 'built', counts: { entries: 11, exits: 11 }, mark } as Partial<Card>);
    },
    simplify: (id) => {
      const mark = C().history.length;
      clearCanvas(); // a new strategy, as one step (Undo brings the old one back)
      markPine('simplified entry');
      C().copilotAdd('entry', simplifiedEntry(), 'Copilot added a simplified entry', 1);
      C().copilotAdd('exit', [rsiExit()], 'Copilot added the exit', 0);
      C().showToast('Added 2 entry conditions');
      patch(id, { phase: 'simplified', counts: countsNow(), mark } as Partial<Card>);
    },

    retryFailed: (id) => {
      patch(id, { phase: 'thinking' } as Partial<Card>);
      later(TIMING.understood * 2, () => patch(id, { phase: 'failed' } as Partial<Card>));
    },
    skipExit: (id) => patch(id, { phase: 'skipped' } as Partial<Card>),
    addExitOnCanvas: () => {
      useStrategy.setState({ mode: 'build' });
      C().addCondition('exit');
    },
    toggleDetails: (id) => {
      const c = cardOf(id);
      if (c?.kind === 'failed') patch(id, { detailsOpen: !c.detailsOpen } as Partial<Card>);
    },

    pickVague: (id, option) => {
      if (option === 3) return patch(id, { chosen: 3 } as Partial<Card>);
      patch(id, { chosen: option } as Partial<Card>);
      add({ kind: 'user', id: uid('u'), text: VAGUE_OPTIONS[option].label });
      runMain(VAGUE_OPTIONS[option].entry());
    },

    // Proof: open the chart with ▲ entry / ▼ exit markers (the Update chart rule still holds)
    checkOnChart: () => {
      useStrategy.setState({ mode: 'build' });
      const w = useWorkspace.getState();
      w.set({ panelOpen: true, bottomTab: 'chart' });
      if (w.pendingChanges > 0 || w.chartStatus === 'error') w.updateChart(countsNow());
    },
    runBacktest: () => {
      useStrategy.setState({ mode: 'backtest' });
      setTimeout(() => useBacktest.getState().runBacktests(), 0);
    },

    setView: (view) => set({ view, focusLine: null }),
    openLine: (line) => set({ view: 'pine', focusLine: line }),
    discardCode: () => {
      const last = [...get().messages].reverse().find((m) => m.kind === 'card' && 'mark' in m.card);
      if (last && last.kind === 'card') get().undo(last.id);
      set({ pineBase: null, view: 'chat' });
    },
    applyCode: () => set({ pineBase: null }),
    newChat: () => {
      stopTimers();
      C().set({ copilotPreview: null, pending: null });
      set({ messages: [], view: 'chat', pineBase: null });
    },
    set: (p) => set(p),
  };
});

export { EXIT_OPTIONS, VAGUE_OPTIONS };
