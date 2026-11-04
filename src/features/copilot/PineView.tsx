import { useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Popover } from '@/components/ui/Popover';
import { Checkbox } from '@/features/canvas/kit/controls';
import { MenuRow, MenuSurface } from '@/features/canvas/kit/menus';
import { changedSince, hunks } from '@/lib/lineDiff';
import { blockAt, sourceMap } from '@/lib/pineMap';
import { TAG, type Problem } from '@/lib/pineParse';
import { EXAMPLES } from '@/mock/pine';
import { useCanvas } from '@/store/canvas';
import { useCopilot } from '@/store/copilot';
import { pendingPatch, unrunLines, usePine } from '@/store/pine';
import { useStrategy } from '@/store/strategy';
import { CodeEditor, type Marks } from './pine/CodeEditor';
import { CardAction, Secondary, Spark, Tertiary } from './parts';

/*
  The Pine Script view of the Copilot panel (design/pine-editor/COMPONENTS.md v2 §3), top to bottom:
  toolbar (44: name · Find · Copy · ⋯) · [conflict banner] · code · log strip · status line (28) ·
  footer (56: Discard left, Run right) · Ask box. No bars, no toasts: the status line says it all.
  Run is the panel's one filled-blue button.
*/

/* ── small parts ───────────────────────────────────────────────── */

const Ico = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const I = {
  find: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevron: 'M6 9l6 6 6-6',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 18l-6-6 6-6',
  send: 'M5 12h14M13 6l6 6-6 6',
};

const ToolButton = ({ label, onClick, children, boxed }: { label: string; onClick?: () => void; children: ReactNode; boxed?: boolean }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex size-7 items-center justify-center rounded-chip text-text-secondary outline-none hover:bg-surface-selected active:bg-row-pressed focus-visible:shadow-focus-ring ${boxed ? 'border border-border-chip bg-surface' : ''}`}
  >
    {children}
  </button>
);

/** `code` in backticks → a grey code chip. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((p, i) =>
        p.startsWith('`') ? <code key={i} className="rounded-[4px] bg-surface-selected px-1 py-px font-mono text-[11.5px]">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

const Spinner = ({ light }: { light?: boolean }) => (
  <span aria-hidden="true" className={`size-3.5 shrink-0 animate-spin rounded-full border-2 border-t-transparent ${light ? 'border-text-on-brand' : 'border-brand'}`} />
);

function ProblemTag({ kind }: { kind: Problem['kind'] }) {
  const red = kind === 'typo' || kind === 'garbled' || kind === 'bracket';
  return <span className={`whitespace-nowrap rounded-[4px] px-1.5 py-px text-[11px] font-medium ${red ? 'bg-error-bg text-error' : 'bg-warn-tint text-warn-text'}`}>{TAG[kind]}</span>;
}

function Diff({ minus, plus }: { minus: string; plus: string }) {
  return (
    <div className="overflow-hidden rounded-chip font-mono text-[11px] leading-5">
      {minus.split('\n').map((l, i) => <div key={`m${i}`} className="whitespace-pre bg-error-bg px-2.5 text-code-diff-minus">−  {l}</div>)}
      {plus.split('\n').map((l, i) => <div key={`p${i}`} className="whitespace-pre bg-buy-tint px-2.5 text-code-diff-plus">+  {l}</div>)}
    </div>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <span className="rounded-[4px] border border-border-control bg-surface px-[5px] py-px font-mono text-[10.5px] text-text-tertiary">{children}</span>
);

/** A choice in a needs-you card: small buttons in a row; the one that matches the canvas starts picked. */
const Choice = ({ label, picked, onClick }: { label: string; picked: boolean; onClick: () => void }) => (
  <button
    type="button"
    aria-pressed={picked}
    onClick={onClick}
    className={`h-[30px] rounded-chip border bg-surface px-3 text-body outline-none focus-visible:shadow-focus-ring ${picked ? 'border-brand shadow-[0_0_0_1px_var(--color-brand)]' : 'border-border-chip hover:bg-surface-hover'}`}
  >
    {label}
  </button>
);

/* ── status line (28px, always the current truth) ──────────────── */

function StatusLine() {
  const s = usePine();
  const edited = s.code !== s.ran;
  const n = unrunLines(s);
  const base = 'flex min-w-0 items-center gap-1.5 truncate text-label font-medium';
  const dot = <span className="size-1.5 shrink-0 rounded-full bg-brand" />;
  const check = (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0"><circle cx="12" cy="12" r="11" className="fill-success" /><path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" /></svg>
  );
  let body: ReactNode;
  if (s.copilotEditing) body = <span className={`${base} text-text-primary`}><Spark size={12} /> Copilot is editing…</span>;
  else if (s.running) body = <span className={`${base} text-brand-text`}><Spinner /> Running…</span>;
  else if (s.problems.length && edited) {
    const errors = s.problems.filter((p) => p.kind !== 'needs' && p.kind !== 'unsupported').length;
    const unsupported = s.problems.find((p) => p.kind === 'unsupported');
    if (errors)
      body = (
        <button type="button" onClick={() => s.goTo(s.problems[0].line)} className={`${base} text-error hover:underline`}>
          <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-error text-[9px] font-bold text-surface">!</span>
          {s.problems.length} error{s.problems.length > 1 ? 's' : ''} · F8 to jump
        </button>
      );
    else if (unsupported) body = <span className={`${base} text-warn-text`}><span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-warn-dot text-[9px] font-bold text-surface">i</span> Line {unsupported.line} isn’t supported yet</span>;
    else body = <span className={`${base} text-warn-text`}>▲ {s.problems.length} needs your choice</span>;
  } else if (edited) body = <span className={`${base} text-text-secondary`}>{dot} {s.draftFrom ? `Draft from ${s.draftFrom} · not run` : `${n} line${n > 1 ? 's' : ''} changed · not run`}</span>;
  else body = <span className={`${base} text-success`}>{check} In sync · {s.lastRun.detail ? `${s.lastRun.detail}${/changed$/.test(s.lastRun.detail) && !/Copilot/.test(s.lastRun.detail) ? ` · ${s.lastRun.at}` : ''}` : `last run ${s.lastRun.at}`}</span>;
  return (
    <div role="status" aria-live="polite" className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-border-divider px-3.5">
      {body}
      <span className="shrink-0 font-mono text-[10.5px] text-text-disabled">Ln {s.caret.line}, Col {s.caret.col}</span>
    </div>
  );
}

/* ── AI fix card (right under the broken line) ─────────────────── */

const CARD = 'flex flex-col gap-2.5 rounded-block border border-border-control bg-surface p-3 shadow-[0_8px_24px_rgba(20,22,28,0.10)]';

export function FixCard({ id, sheet }: { id: string; sheet?: boolean }) {
  const s = usePine();
  const p = s.problems.find((x) => x.id === id);
  const [radio, setRadio] = useState(0);
  if (!p) return null;
  const applying = s.fixing === id;
  const header = (
    <div className="flex items-center gap-1.5 text-label">
      {p.kind === 'unsupported' ? <span className="flex size-3.5 items-center justify-center rounded-full bg-warn-dot text-[9px] font-bold text-surface">i</span> : <Spark size={12} />}
      <span className="font-semibold">{p.kind === 'unsupported' ? 'Not supported in AlgoTest yet' : 'AI fix'}</span>
      <span className="text-text-disabled">·</span>
      <span className="text-text-secondary">Line {p.line}</span>
      {p.kind !== 'unsupported' && <ProblemTag kind={p.kind} />}
    </div>
  );
  const body = 'text-chip leading-[18px] text-text-primary';
  const wrap = (children: ReactNode) => (sheet ? <div className="flex flex-col gap-2.5">{children}</div> : <div className={CARD}>{children}</div>);
  const working = (
    <div className="flex items-center gap-2">
      <Spinner />
      <span className="grow text-body font-medium text-brand">Fixing and running…</span>
      <Kbd>⌘ .</Kbd>
    </div>
  );

  if (p.kind === 'needs') {
    const chosen = s.answers[id] ?? 0;
    return wrap(
      <>
        {header}
        <div className={body}><Words text={p.question ?? p.explain} /></div>
        <div className="flex flex-wrap gap-2">
          {p.options!.map((o, i) => <Choice key={o.label} label={o.label} picked={chosen === i} onClick={() => s.choose(id, i)} />)}
        </div>
        {p.options!.every((o) => o.line !== null) && <span className="text-label text-text-tertiary">{p.explain}</span>}
        {!sheet && (applying ? working : (
          <div className="flex items-center gap-2">
            <CardAction onClick={() => s.applyAnswer(id)}>{p.options![chosen]?.line === null ? 'Done' : 'Apply & run'}</CardAction>
            <Secondary onClick={() => s.ignore(id)}>I’ll edit it</Secondary>
          </div>
        ))}
      </>,
    );
  }

  if (p.kind === 'unsupported')
    return wrap(
      <>
        {header}
        <div className={body}><Words text={p.explain} /></div>
        {p.options!.map((o, i) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setRadio(i)}
            className={`flex gap-2.5 rounded-lg border bg-surface p-2.5 text-left outline-none focus-visible:shadow-focus-ring ${radio === i ? 'border-brand shadow-[0_0_0_1px_var(--color-brand)]' : 'border-border-chip hover:bg-surface-hover'}`}
          >
            <span className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${radio === i ? 'border-brand' : 'border-code-radio-off'}`}>
              {radio === i && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-chip font-semibold">{o.label}{o.suggested && <span className="text-[11px] font-medium text-brand"> · Recommended</span>}</span>
              <span className="text-hint text-text-tertiary">{o.hint}</span>
            </span>
          </button>
        ))}
        <div className="flex items-center gap-1">
          <CardAction onClick={() => s.unsupported(id, radio)}>Continue</CardAction>
          <Tertiary onClick={() => s.ignore(id)}>Cancel</Tertiary>
        </div>
      </>,
    );

  return wrap(
    <>
      {header}
      <div className={body}><Words text={p.explain} /></div>
      {p.fix && <Diff minus={p.fix.minus} plus={p.fix.plus} />}
      {!sheet && (applying ? working : (
        <div className="flex flex-wrap items-center gap-2">
          <CardAction onClick={() => s.fix(id)}>Fix &amp; run</CardAction>
          <Secondary onClick={() => s.ignore(id)}>Ignore</Secondary>
          <span className="flex-1" />
          <Kbd>⌘ .</Kbd>
        </div>
      ))}
    </>,
  );
}

/** Copilot wants to change lines you typed: shown in place as a diff; nothing changes until Apply. */
function PendingCard() {
  const code = usePine((s) => s.code);
  const cp = useCopilot();
  const next = pendingPatch();
  const card = [...cp.messages].reverse().find((m) => m.kind === 'card' && m.card.kind === 'review' && m.card.phase === 'pending');
  if (!next || !card) return null;
  const hs = hunks(code.split('\n'), next.split('\n'));
  const minus = hs.flatMap((h) => code.split('\n').slice(h.from, h.to)).join('\n');
  const plus = hs.flatMap((h) => h.lines).join('\n');
  return (
    <div className={CARD}>
      <div className="flex items-center gap-1.5 text-label">
        <Spark size={12} />
        <span className="font-semibold">Copilot suggests</span>
        <span className="text-text-disabled">·</span>
        <span className="text-text-secondary">changes lines you wrote</span>
      </div>
      <Diff minus={minus || '(nothing)'} plus={plus || '(removed)'} />
      <div className="flex items-center gap-2">
        <Secondary onClick={() => cp.cancelReview(card.id)}>Cancel</Secondary>
        <span className="flex-1" />
        <CardAction onClick={() => { cp.applyReview(card.id); }}>Apply</CardAction>
      </div>
    </div>
  );
}

/* ── 2A summary bar (3 or more problems) ───────────────────────── */

function SummaryBar() {
  const s = usePine();
  const fixable = s.problems.filter((p) => p.fix).length;
  const needs = s.problems.length - fixable;
  return (
    <div className={`mx-3 my-2.5 shrink-0 ${CARD}`}>
      <div className="flex items-center gap-2">
        <Spark size={13} />
        <span className="flex-1 text-body font-semibold">{s.problems.length} problems found</span>
        <span className="text-hint text-text-tertiary">↑ ↓ to step</span>
      </div>
      <div className="flex gap-3.5 text-label text-text-secondary">
        <span className="flex items-center gap-1.5"><span className="size-[7px] rounded-full bg-sell" />{fixable} AI can fix</span>
        {needs > 0 && <span className="flex items-center gap-1.5"><span className="size-[7px] rounded-full bg-warn-dot" />{needs} needs you</span>}
      </div>
      <div className="flex gap-2">
        <CardAction onClick={s.startReview}>Fix all {fixable}</CardAction>
        <Secondary onClick={s.oneByOne}>Review one by one</Secondary>
      </div>
    </div>
  );
}

/* ── 2B review all (replaces the code; nothing changes until Apply) ── */

function ReviewAll() {
  const s = usePine();
  if (s.review?.mode !== 'all') return null;
  const r = s.review;
  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-divider px-2">
        <ToolButton label="Back to the code" onClick={s.closeReview}><Ico d={I.back} /></ToolButton>
        <span className="text-chip font-semibold">Review AI fixes</span>
        <span className="text-label text-text-tertiary">{r.selected.length} of {s.problems.length} selected</span>
      </div>
      <div className="flex min-h-0 grow flex-col gap-2.5 overflow-y-auto p-3">
        {s.problems.map((p) =>
          p.options ? (
            <div key={p.id} className="flex flex-col gap-2 rounded-block border border-warn-dot bg-warn-tint p-3">
              <div className="flex items-center gap-2 text-label"><span className="size-[7px] rounded-full bg-warn-dot" /><span className="font-semibold">Line {p.line}</span><ProblemTag kind={p.kind} /></div>
              <div className="text-chip"><Words text={p.question ?? p.explain} /></div>
              <div className="flex flex-wrap gap-2">
                {p.options.map((o, i) => <Choice key={o.label} label={o.label.replace(' · matches canvas', '')} picked={r.selected.includes(p.id) && (r.answers[p.id] ?? -1) === i} onClick={() => s.answerReview(p.id, i)} />)}
                <Secondary onClick={() => r.selected.includes(p.id) && s.toggleReview(p.id)}>Skip for now</Secondary>
              </div>
            </div>
          ) : (
            <div key={p.id} className="flex flex-col gap-2 rounded-block border border-border-control bg-surface p-3">
              <div className="flex items-center gap-2 text-label">
                <Checkbox label={`Apply the fix on line ${p.line}`} checked={r.selected.includes(p.id)} onChange={() => s.toggleReview(p.id)} />
                <span className="font-semibold">Line {p.line}</span>
                <ProblemTag kind={p.kind} />
              </div>
              {p.fix && <Diff minus={p.fix.minus} plus={p.fix.plus} />}
            </div>
          ),
        )}
        <p className="m-0 text-label text-text-tertiary">Nothing changes until you apply. Untick to leave one. The needs-you item stays until it’s answered.</p>
      </div>
    </div>
  );
}

/* ── 2C one by one (a bottom sheet over the code) ──────────────── */

function OneByOne() {
  const s = usePine();
  if (s.review?.mode !== 'one') return null;
  const r = s.review;
  const p = s.problems[r.index];
  const rest = s.problems.slice(r.index + 1).filter((x) => x.fix).length;
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 rounded-t-[14px] border-t border-border-control bg-surface px-4 pt-2 pb-3 shadow-[0_-12px_32px_rgba(20,22,28,0.12)]">
      <span className="mx-auto h-1 w-9 rounded-full bg-border-strong" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-chip font-semibold">Problem {r.index + 1} of {s.problems.length}</span>
        <ToolButton boxed label="Previous problem" onClick={() => s.stepOne(-1)}><Ico d={I.up} size={14} /></ToolButton>
        <ToolButton boxed label="Next problem" onClick={() => s.stepOne(1)}><Ico d={I.down} size={14} /></ToolButton>
        <ToolButton label="Close" onClick={s.closeReview}><Ico d={I.close} size={14} /></ToolButton>
      </div>
      <FixCard id={p.id} sheet />
      <span className="text-label text-text-tertiary">Fixed {r.fixed} of {s.problems.length} · the code runs when you finish</span>
      <div className="flex items-center gap-2">
        <CardAction onClick={s.fixOne}>{p.options ? 'Apply & next' : 'Fix & next'}</CardAction>
        <Secondary onClick={s.skipOne}>Skip</Secondary>
        <span className="flex-1" />
        {rest > 0 && <Tertiary onClick={s.fixRemaining}>Fix remaining {rest}</Tertiary>}
      </div>
    </div>
  );
}

/* ── find (⌘F) ─────────────────────────────────────────────────── */

function FindBar({ query, setQuery, count, index, step, onClose }: { query: string; setQuery: (q: string) => void; count: number; index: number; step: (d: 1 | -1) => void; onClose: () => void }) {
  return (
    <div className="absolute top-2 right-3 z-10 flex w-[300px] items-center gap-1 rounded-block border border-border-control bg-surface p-1.5 shadow-surface">
      <input
        autoFocus
        aria-label="Find in code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(e.shiftKey ? -1 : 1);
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Find"
        className="h-7 min-w-0 grow rounded-chip border border-brand px-2 font-mono text-[11.5px] outline-none shadow-focus-ring"
      />
      <span className="shrink-0 px-1 text-label text-text-tertiary tabular-nums">{count ? `${index + 1} of ${count}` : query ? 'No results' : ''}</span>
      <ToolButton label="Previous match" onClick={() => step(-1)}><Ico d={I.up} size={14} /></ToolButton>
      <ToolButton label="Next match" onClick={() => step(1)}><Ico d={I.down} size={14} /></ToolButton>
      <ToolButton label="Close find" onClick={() => onClose()}><Ico d={I.close} size={14} /></ToolButton>
    </div>
  );
}

/* ── the editor ────────────────────────────────────────────────── */

export function PineView() {
  const s = usePine();
  const name = useStrategy((x) => x.name) ?? 'Untitled strategy';
  const send = useCopilot((x) => x.send);
  const { entry, exit, editorId, pending } = useCanvas(useShallow((c) => ({ entry: c.entry, exit: c.exit, editorId: c.editor?.id ?? null, pending: c.pending })));
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState('');
  const [find, setFind] = useState<{ q: string; i: number } | null>(null);
  const edited = s.code !== s.ran;
  const n = unrunLines(s);

  // block ↔ lines
  const map = useMemo(() => sourceMap(s.code, { entry, exit }), [s.code, entry, exit]);

  // clicking a block on the canvas highlights its lines and scrolls them into view (the caret stays)
  const linked = useMemo(() => (editorId ? map.get(editorId) ?? [] : []), [editorId, map]);
  const firstLinked = linked[0];
  // a new object only when another block is clicked, so the editor scrolls once
  const reveal = useMemo(() => (firstLinked ? { line: firstLinked, n: 0 } : null), [editorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const q = find?.q.toLowerCase();
    if (!q) return [];
    const out: { from: number; to: number }[] = [];
    const text = s.code.toLowerCase();
    for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + q.length)) out.push({ from: at, to: at + q.length });
    return out;
  }, [find, s.code]);
  const findIndex = matches.length ? (((find?.i ?? 0) % matches.length) + matches.length) % matches.length : 0;

  const marks: Marks = useMemo(() => {
    // fix cards only after Run (never while typing), at most two; 3+ get the summary bar
    const cards = s.cardsOpen && s.problems.length > 0 && s.problems.length < 3 && !s.review;
    const lines: Marks['lines'] = [];
    changedSince(s.ran.split('\n'), s.code.split('\n')).forEach((line) => lines.push({ line, kind: 'edited' }));
    s.aiLines.forEach((line) => lines.push({ line, kind: 'ai' }));
    for (const p of s.problems) lines.push({ line: p.line, kind: p.kind === 'needs' ? 'needs' : p.kind === 'unsupported' ? 'unsupported' : 'error' });
    if (s.justFixed) lines.push({ line: s.justFixed.line, kind: 'fixed' });
    if (s.review?.mode === 'one') lines.push({ line: s.problems[s.review.index]?.line ?? 0, kind: 'step' });
    linked.forEach((line) => lines.push({ line, kind: 'linked' }));
    const widgets: Marks['widgets'] = cards ? s.problems.filter((p) => !s.closed.includes(p.id)).map((p) => ({ line: p.line, key: p.id, node: <FixCard id={p.id} /> })) : [];
    // Copilot's change to lines you typed, in place, waiting for Apply
    if (pending) {
      const at = changedSince(s.code.split('\n'), (pendingPatch() ?? s.code).split('\n'))[0];
      if (at) widgets.push({ line: Math.max(1, at - 1), key: `pending-${JSON.stringify(pending).length}`, node: <PendingCard /> });
    }
    return {
      lines,
      underlines: s.problems.filter((p) => p.to > p.from).map((p) => ({ line: p.line, from: p.from, to: p.to, tone: p.kind === 'needs' || p.kind === 'unsupported' ? 'amber' : 'red' })),
      highlights: s.justFixed ? [s.justFixed] : [],
      widgets,
      find: matches.map((m, i) => ({ ...m, current: i === findIndex })),
    };
  }, [s.problems, s.cardsOpen, s.review, s.closed, s.justFixed, s.aiLines, s.code, s.ran, matches, findIndex, linked, pending]);

  const copy = () => void navigator.clipboard?.writeText(s.code);
  const acceptFix = (line: number) => {
    const p = s.problems.find((x) => x.line === line && x.fix);
    if (p) s.fix(p.id);
  };
  const reviewAll = s.review?.mode === 'all';
  const runOn = edited && !s.running && !s.copilotEditing;
  const submitAsk = () => {
    if (!ask.trim() || s.copilotEditing) return;
    const lines = s.askChip ? `(lines ${s.askChip.from}${s.askChip.to > s.askChip.from ? `–${s.askChip.to}` : ''}) ` : '';
    s.ask();
    send(lines + ask, { stay: true });
    setAsk('');
    usePine.setState({ askChip: null });
    // Copilot writes for about a second; if it only answered in words, the editor opens up again
    setTimeout(() => usePine.getState().copilotEditing && usePine.setState({ copilotEditing: false, asking: false }), 1800);
  };
  // caret in a mapped line: its block gets the hover ring on the canvas
  const onCaret = (line: number, col: number) => {
    usePine.setState({ caret: { line, col } });
    const id = blockAt(map, line);
    if (useCanvas.getState().linkedHover !== id) useCanvas.setState({ linkedHover: id });
  };

  return (
    <div className="flex min-h-0 grow flex-col">
      {!reviewAll && (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-divider pr-2 pl-3.5">
          <span className="max-w-[170px] grow truncate text-chip font-medium">{name}</span>
          <span className="flex-1" />
          <ToolButton label="Find (⌘F)" onClick={() => setFind({ q: find?.q ?? '', i: 0 })}><Ico d={I.find} /></ToolButton>
          <ToolButton label="Copy code" onClick={copy}><Ico d={I.copy} /></ToolButton>
          <Popover floating align="right" open={menu} onClose={() => setMenu(false)} trigger={<ToolButton label="More" onClick={() => setMenu((m) => !m)}><Ico d={I.more} /></ToolButton>}>
            <MenuSurface width={240} label="Pine Script actions">
              <div className="flex flex-col p-1">
                <span className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-text-subtle">LOAD EXAMPLE</span>
                {EXAMPLES.map((e) => <MenuRow key={e.id} onClick={() => { setMenu(false); s.loadExample(e.id); }}>{e.label}</MenuRow>)}
              </div>
            </MenuSurface>
          </Popover>
        </div>
      )}

      {/* the only banner: the canvas changed lines you're still editing */}
      {!reviewAll && s.conflict && (
        <div className="flex shrink-0 gap-2 border-b border-warn-dot/40 bg-warn-tint px-3.5 py-2.5 text-label">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 2.5L23 21.5H1z" className="fill-warn-dot" /><path d="M12 9v5M12 17.5v.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" /></svg>
          <span className="flex flex-col gap-2">
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-text-primary">The canvas changed lines you’re editing</span>
              <span className="text-text-secondary">You changed a block while {s.conflict.lines[1] > s.conflict.lines[0] ? `lines ${s.conflict.lines[0]}–${s.conflict.lines[1]}` : `line ${s.conflict.lines[0]}`} had edits that didn’t run.</span>
            </span>
            <span className="flex gap-2"><Secondary onClick={s.keepMine}>Keep my code</Secondary><Secondary onClick={s.useCanvasVersion}>Use the canvas version</Secondary></span>
          </span>
        </div>
      )}

      {reviewAll ? (
        <ReviewAll />
      ) : (
        <div className="relative min-h-0 grow">
          <CodeEditor
            value={s.code}
            source={s.source}
            readOnly={s.copilotEditing}
            marks={marks}
            focus={s.focus}
            reveal={reveal}
            onChange={s.type}
            onRun={() => runOn && s.run()}
            onAcceptFix={acceptFix}
            onNextProblem={s.nextProblem}
            onFind={() => setFind({ q: find?.q ?? '', i: 0 })}
            onCaret={onCaret}
            onAskLines={(from, to) => {
              usePine.setState({ askChip: { from, to } });
              document.querySelector<HTMLInputElement>('input[aria-label="Ask Copilot about the code"]')?.focus();
            }}
          />
          {find && (
            <FindBar
              query={find.q}
              setQuery={(q) => setFind({ q, i: 0 })}
              count={matches.length}
              index={findIndex}
              step={(d) => {
                const i = findIndex + d;
                setFind({ q: find.q, i });
                const m = matches[((i % matches.length) + matches.length) % matches.length];
                if (m) s.goTo(s.code.slice(0, m.from).split('\n').length, true);
              }}
              onClose={() => setFind(null)}
            />
          )}
          <OneByOne />
        </div>
      )}

      {!reviewAll && s.cardsOpen && s.problems.length >= 3 && !s.review && <SummaryBar />}

      {/* log strip (collapsible) */}
      {!reviewAll && s.log.length > 0 && (
        <div className="flex shrink-0 items-start gap-2.5 border-t border-border-divider bg-code-log px-3.5 py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {s.cardsOpen && s.problems.length >= 3 && !s.logOpen ? (
              <div className="flex items-center gap-2 text-label">
                <span className="whitespace-nowrap rounded-[4px] bg-error-bg px-1.5 py-px text-[11px] font-medium text-error">{s.problems.length} errors</span>
                <span className="flex-1 text-text-tertiary">Compiler log collapsed</span>
                <button type="button" onClick={() => usePine.setState({ logOpen: true })} className="font-medium text-brand">Show log</button>
              </div>
            ) : (
              (s.logOpen ? s.log : s.log.slice(-1)).map((l) => (
                <div key={l.id} className="flex items-center gap-2 font-mono text-[11px] leading-[18px]">
                  {l.tag ? (
                    <span className={`shrink-0 rounded-[4px] px-1.5 py-px ${l.tone === 'needs' ? 'bg-warn-tint text-warn-text' : 'bg-error-bg text-error'}`}>{l.tag}</span>
                  ) : (
                    <span className="shrink-0 text-text-disabled">{l.time}</span>
                  )}
                  <span className={`flex-1 truncate ${l.tone === 'ok' ? 'text-success' : l.tone === 'error' ? 'text-error' : l.tone === 'needs' ? 'text-warn-text' : 'text-text-tertiary'}`}>{l.text}</span>
                  {l.problemId && s.problems.some((p) => p.id === l.problemId) && (s.closed.includes(l.problemId) || !s.cardsOpen) && (
                    <button type="button" onClick={() => s.reopen(l.problemId!)} className="font-sans text-label font-medium whitespace-nowrap text-brand">Fix with AI</button>
                  )}
                </div>
              ))
            )}
          </div>
          <button type="button" aria-label={s.logOpen ? 'Collapse log' : 'Expand log'} onClick={() => usePine.setState({ logOpen: !s.logOpen })} className={`pt-0.5 text-text-tertiary transition-transform ${s.logOpen ? '' : 'rotate-180'}`}>
            <Ico d={I.chevron} size={14} />
          </button>
        </div>
      )}

      {!reviewAll && <StatusLine />}

      <div className="flex h-14 shrink-0 items-center gap-2.5 border-t border-border-divider px-3.5">
        {reviewAll ? (
          <>
            <Secondary onClick={s.closeReview}>Cancel</Secondary>
            <span className="flex-1" />
            <button type="button" onClick={s.applyReview} disabled={!s.review || (s.review.mode === 'all' && !s.review.selected.length)} title="Apply and run (⌘↵)" className="inline-flex h-8 items-center gap-2 rounded-chip bg-brand px-3.5 text-body font-medium text-text-on-brand outline-none hover:bg-brand-pressed focus-visible:shadow-focus-ring disabled:bg-surface-disabled disabled:text-text-disabled">
              Apply {s.review?.mode === 'all' ? s.review.selected.length : ''} &amp; run
            </button>
          </>
        ) : (
          <>
            <span title={n ? `Throw away ${n > 1 ? `${n} lines that haven’t` : '1 line that hasn’t'} run` : 'Nothing that hasn’t run'}>
              <button
                type="button"
                disabled={!edited || s.running}
                onClick={s.discard}
                className="h-8 rounded-chip border border-border-chip bg-surface px-3 text-body font-medium text-text-primary outline-none hover:bg-surface-hover active:bg-row-pressed focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled"
              >
                Discard changes
              </button>
            </span>
            <span className="flex-1" />
            {/* the panel's one filled-blue button: just "Run ▸" (⌘↵ is in the tooltip) */}
            <button
              type="button"
              onClick={() => s.run()}
              disabled={!runOn}
              aria-busy={s.running || undefined}
              title={runOn ? 'Run (⌘↵)' : 'Nothing new to run'}
              className="inline-flex h-8 items-center gap-2 rounded-chip bg-brand px-3.5 text-body font-medium text-text-on-brand outline-none hover:bg-brand-pressed active:bg-brand-pressed focus-visible:shadow-focus-ring disabled:bg-surface-disabled disabled:text-text-disabled aria-busy:bg-brand aria-busy:text-text-on-brand"
            >
              {s.running ? <><Spinner light /> Running…</> : <>Run <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3l15 9-15 9z" fill="currentColor" /></svg></>}
            </button>
          </>
        )}
      </div>

      {/* Ask Copilot: the strategy's current chat, scoped to this script */}
      <div className="shrink-0 border-t border-border-divider px-3.5 pt-2.5 pb-3">
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-border-control bg-surface pr-1.5 pl-3 focus-within:shadow-focus-ring">
          <Spark size={12} />
          {s.askChip && (
            <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-chip bg-surface-selected px-2 font-mono text-[11px] text-text-secondary">
              Lines {s.askChip.from}{s.askChip.to > s.askChip.from ? `–${s.askChip.to}` : ''}
              <button type="button" aria-label="Remove the lines" onClick={() => usePine.setState({ askChip: null })} className="text-text-tertiary hover:text-text-primary">✕</button>
            </span>
          )}
          <input
            aria-label="Ask Copilot about the code"
            value={ask}
            disabled={s.copilotEditing}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAsk()}
            placeholder="Ask Copilot to change or explain the code…"
            className="h-full min-w-0 grow border-0 bg-transparent text-chip outline-none placeholder:text-text-subtle"
          />
          {/* filled only when Run isn't the filled button on screen */}
          <button
            type="button"
            aria-label="Send to Copilot"
            disabled={!ask.trim()}
            onClick={submitAsk}
            className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${!ask.trim() ? 'bg-surface-selected text-text-subtle' : runOn ? 'border border-brand bg-surface text-brand' : 'bg-brand text-text-on-brand'}`}
          >
            <Ico d={I.send} size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
