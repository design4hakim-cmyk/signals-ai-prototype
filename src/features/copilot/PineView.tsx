import { useMemo, useState, type ReactNode } from 'react';
import { Popover } from '@/components/ui/Popover';
import { Checkbox } from '@/features/canvas/kit/controls';
import { MenuRow, MenuSurface } from '@/features/canvas/kit/menus';
import { changedSince } from '@/lib/lineDiff';
import { TAG, type Problem } from '@/lib/pineParse';
import { EXAMPLES } from '@/mock/pine';
import { useCopilot } from '@/store/copilot';
import { changesSinceOpen, usePine } from '@/store/pine';
import { useStrategy } from '@/store/strategy';
import { CodeEditor, type Marks } from './pine/CodeEditor';
import { AnswerOption, CardAction, CodeGlyph, Secondary, Spark, StatusIcon, Tertiary } from './parts';

/*
  The Pine Script editor inside the Copilot panel (design/pine-editor §3), top to bottom:
  toolbar (44) · [banner] · code · [summary bar] · log strip · footer (Discard · Run) · Ask box.
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
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 18l-6-6 6-6',
  send: 'M5 12h14M13 6l6 6-6 6',
};

const ToolButton = ({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className="flex size-7 items-center justify-center rounded-chip text-text-secondary outline-none hover:bg-surface-selected active:bg-row-pressed focus-visible:shadow-focus-ring">
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
  <span aria-hidden="true" className={`size-3.5 animate-spin rounded-full border-2 border-t-transparent ${light ? 'border-text-on-brand' : 'border-brand'}`} />
);

function ProblemTag({ kind }: { kind: Problem['kind'] }) {
  const red = kind === 'typo' || kind === 'garbled' || kind === 'bracket';
  return <span className={`whitespace-nowrap rounded-[4px] px-1.5 py-px text-[11px] font-medium ${red ? 'bg-error-bg text-error' : 'bg-warn-tint text-warn-text'}`}>{TAG[kind]}</span>;
}

function Diff({ minus, plus }: { minus: string; plus: string }) {
  return (
    <div className="overflow-hidden rounded-chip font-mono text-[11px] leading-5">
      <div className="whitespace-pre bg-error-bg px-2.5 text-code-diff-minus">−  {minus}</div>
      <div className="whitespace-pre bg-buy-tint px-2.5 text-code-diff-plus">+  {plus}</div>
    </div>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <span className="rounded-[4px] border border-border-control bg-surface px-[5px] py-px font-mono text-[10.5px] text-text-tertiary">{children}</span>
);

/* ── status chip (always the current truth) ────────────────────── */

function StatusChip() {
  const s = usePine();
  const edited = s.code !== s.ran;
  const base = 'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-chip px-2 text-hint font-medium';
  if (s.running) return <span className={`${base} bg-brand-tint text-brand`}><Spinner /> Running…</span>;
  if (s.problems.length) {
    const fixable = s.problems.filter((p) => p.kind !== 'needs' && p.kind !== 'unsupported').length;
    if (s.problems.every((p) => p.kind === 'unsupported')) return <span className={`${base} bg-warn-tint text-warn-text`}>ⓘ Not supported yet</span>;
    if (!fixable) return <span className={`${base} bg-warn-tint text-warn-text`}>▲ {s.problems.length} needs you</span>;
    return <span className={`${base} bg-error-bg text-error`}>! {s.problems.length} error{s.problems.length > 1 ? 's' : ''}</span>;
  }
  if (edited) return <span className={`${base} bg-surface-selected text-text-secondary`}><span className="size-1.5 rounded-full bg-brand" /> Edited · not run</span>;
  if (s.aiLines.length) return <span className={`${base} bg-ai-tint text-ai-text`}><Spark size={12} /> Copilot changed {s.aiLines.length} line{s.aiLines.length > 1 ? 's' : ''}</span>;
  if (s.memoryLines.length) return <span className={`${base} bg-surface-selected text-text-secondary`}><CodeGlyph /> Runs from code</span>;
  return <span className={`${base} bg-success-bg text-success`}><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" className="fill-success" /><path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" /></svg> In sync with canvas</span>;
}

/* ── AI fix card (sits right under the broken line) ────────────── */

const CARD = 'flex flex-col gap-2.5 rounded-block border border-border-control bg-surface p-3 shadow-[0_8px_24px_rgba(20,22,28,0.10)]';

export function FixCard({ id, sheet }: { id: string; sheet?: boolean }) {
  const s = usePine();
  const p = s.problems.find((x) => x.id === id);
  const [radio, setRadio] = useState(0);
  if (!p) return null;
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
  if (s.fixing === id)
    return wrap(<>{header}<span className="flex items-center gap-2 text-chip text-text-secondary"><Spinner /> Fixing and running…</span></>);

  if (p.kind === 'needs') {
    const chosen = s.answers[id] ?? 0;
    return wrap(
      <>
        {header}
        <div className={body}><Words text={p.question ?? p.explain} /></div>
        <div className="flex flex-col gap-1.5">
          {p.options!.map((o, i) => <AnswerOption key={o.label} label={o.label} hint={o.hint} suggested={o.suggested} chosen={chosen === i && !o.suggested ? true : undefined} onClick={() => s.choose(id, i)} />)}
        </div>
        <span className="text-label text-text-tertiary">{p.explain}</span>
        {!sheet && (
          <div className="flex items-center gap-2">
            <CardAction onClick={() => s.applyAnswer(id)}>{p.options![chosen]?.line === null ? 'Done' : 'Apply & run'}</CardAction>
            <Secondary onClick={() => s.ignore(id)}>I’ll edit it</Secondary>
          </div>
        )}
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
        <div className="flex items-center gap-2">
          <CardAction onClick={() => s.unsupported(id, radio)}>Continue</CardAction>
          <Secondary onClick={() => s.ignore(id)}>Cancel</Secondary>
        </div>
      </>,
    );

  return wrap(
    <>
      {header}
      <div className={body}><Words text={p.explain} /></div>
      {p.fix && <Diff minus={p.fix.minus} plus={p.fix.plus} />}
      {!sheet && (
        <div className="flex flex-wrap items-center gap-2">
          <CardAction onClick={() => s.fix(id)}>Fix &amp; run</CardAction>
          <Secondary onClick={() => s.ignore(id)}>Ignore</Secondary>
          <span className="flex-1" />
          <Kbd>⌘ .</Kbd>
        </div>
      )}
    </>,
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
        <StatusIcon kind="failed" />
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

/* ── 2B review all (replaces the editor body) ──────────────────── */

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
              <div className="flex items-center gap-2 text-label"><span className="font-semibold">Line {p.line}</span><ProblemTag kind={p.kind} /></div>
              <div className="text-chip"><Words text={p.question ?? p.explain} /></div>
              {p.options.map((o, i) => (
                <AnswerOption key={o.label} label={o.label.replace(' · matches canvas', '')} suggested={o.suggested} chosen={r.selected.includes(p.id) && r.answers[p.id] === i && !o.suggested ? true : undefined}
                  onClick={() => usePine.setState({ review: { ...r, answers: { ...r.answers, [p.id]: i }, selected: r.selected.includes(p.id) ? r.selected : [...r.selected, p.id] } })} />
              ))}
              <span><Tertiary onClick={() => s.toggleReview(p.id)}>{r.selected.includes(p.id) ? 'Skip for now' : 'Answer this'}</Tertiary></span>
            </div>
          ) : (
            <div key={p.id} className="flex gap-2.5 rounded-block border border-border-control bg-surface p-3">
              <Checkbox label={`Apply the fix on line ${p.line}`} checked={r.selected.includes(p.id)} onChange={() => s.toggleReview(p.id)} />
              <div className="flex min-w-0 grow flex-col gap-2">
                <div className="flex items-center gap-2 text-label"><span className="font-semibold">Line {p.line}</span><ProblemTag kind={p.kind} /></div>
                {p.fix && <Diff minus={p.fix.minus} plus={p.fix.plus} />}
              </div>
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
  const rest = s.problems.slice(r.index).filter((x) => x.fix).length;
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 rounded-t-[14px] border-t border-border-control bg-surface px-4 pt-2 pb-3 shadow-[0_-12px_32px_rgba(20,22,28,0.12)]">
      <span className="mx-auto h-1 w-9 rounded-full bg-border-strong" aria-hidden="true" />
      <div className="flex items-center gap-1">
        <span className="flex-1 text-chip font-semibold">Problem {r.index + 1} of {s.problems.length}</span>
        <ToolButton label="Previous problem" onClick={() => s.stepOne(-1)}><Ico d={I.up} /></ToolButton>
        <ToolButton label="Next problem" onClick={() => s.stepOne(1)}><Ico d={I.down} /></ToolButton>
        <ToolButton label="Close" onClick={s.closeReview}><Ico d={I.close} /></ToolButton>
      </div>
      <FixCard id={p.id} sheet />
      <span className="text-label text-text-tertiary">Fixed {r.fixed} of {s.problems.length} · the code runs when you finish</span>
      <div className="flex flex-wrap items-center gap-2">
        <CardAction onClick={s.fixOne}>{p.options ? 'Apply & next' : 'Fix & next'}</CardAction>
        <Secondary onClick={s.skipOne}>Skip</Secondary>
        {rest > 1 && <Tertiary onClick={s.fixRemaining}>Fix remaining {rest}</Tertiary>}
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
        className="h-7 min-w-0 grow rounded-chip border border-border-control px-2 font-mono text-[11.5px] outline-none focus:shadow-focus-ring"
      />
      <span className="shrink-0 px-1 text-label text-text-tertiary tabular-nums">{count ? `${index + 1} of ${count}` : query ? 'No results' : ''}</span>
      <ToolButton label="Previous match" onClick={() => step(-1)}><Ico d={I.up} /></ToolButton>
      <ToolButton label="Next match" onClick={() => step(1)}><Ico d={I.down} /></ToolButton>
      <ToolButton label="Close find" onClick={onClose}><Ico d={I.close} /></ToolButton>
    </div>
  );
}

/* ── the editor ────────────────────────────────────────────────── */

export function PineView() {
  const s = usePine();
  const name = useStrategy((x) => x.name) ?? 'Untitled strategy';
  const send = useCopilot((x) => x.send);
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState('');
  const [find, setFind] = useState<{ q: string; i: number } | null>(null);
  const edited = s.code !== s.ran;
  const changes = changesSinceOpen(s);

  // find matches (offsets in the code)
  const matches = useMemo(() => {
    if (!find?.q) return [];
    const out: { from: number; to: number }[] = [];
    const q = find.q.toLowerCase();
    const text = s.code.toLowerCase();
    for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + q.length)) out.push({ from: at, to: at + q.length });
    return out;
  }, [find?.q, s.code]);
  const findIndex = matches.length ? (((find?.i ?? 0) % matches.length) + matches.length) % matches.length : 0;

  const marks: Marks = useMemo(() => {
    const show = s.problems.length > 0 && s.problems.length < 3 && !s.review;
    const lines: Marks['lines'] = [];
    // edited since the last Run (2px blue bar); Copilot's lines (violet)
    if (edited && !s.problems.length) changedSince(s.ran.split('\n'), s.code.split('\n')).forEach((line) => lines.push({ line, kind: 'edited' }));
    if (!edited) s.aiLines.forEach((line) => lines.push({ line, kind: 'ai' }));
    for (const p of s.problems) lines.push({ line: p.line, kind: p.kind === 'needs' ? 'needs' : p.kind === 'unsupported' ? 'unsupported' : 'error' });
    if (s.justFixed) lines.push({ line: s.justFixed.line, kind: 'fixed' });
    if (s.review?.mode === 'one') lines.push({ line: s.problems[s.review.index]?.line ?? 0, kind: 'step' });
    return {
      lines,
      underlines: s.problems.filter((p) => p.to > p.from).map((p) => ({ line: p.line, from: p.from, to: p.to, tone: p.kind === 'needs' || p.kind === 'unsupported' ? 'amber' : 'red' })),
      highlights: s.justFixed ? [s.justFixed] : [],
      widgets: show ? s.problems.filter((p) => !s.closed.includes(p.id)).map((p) => ({ line: p.line, key: `${p.id}`, node: <FixCard id={p.id} /> })) : [],
      find: matches.map((m, i) => ({ ...m, current: i === findIndex })),
    };
  }, [s.problems, s.review, s.closed, s.justFixed, s.aiLines, s.code, s.ran, edited, matches, findIndex]);

  const copy = () => {
    void navigator.clipboard?.writeText(s.code);
    usePine.setState({ toast: { text: 'Copied Pine Script' } });
    setTimeout(() => usePine.setState({ toast: null }), 2500);
  };
  const acceptFix = (line: number) => {
    const p = s.problems.find((x) => x.line === line && x.fix);
    if (p) s.fix(p.id);
  };
  const reviewAll = s.review?.mode === 'all';
  const runOn = edited && !s.running;
  const submitAsk = () => {
    if (!ask.trim()) return;
    send(ask, { stay: true });
    setAsk('');
  };

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* toolbar */}
      {!reviewAll && (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-divider pr-2 pl-3.5">
          <span className="max-w-[170px] truncate text-chip font-medium">{name}</span>
          <StatusChip />
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

      {/* banners */}
      {!reviewAll && !edited && s.aiLines.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 bg-ai-tint py-2 pr-3 pl-3.5 text-label">
          <Spark size={12} />
          <span className="flex-1">Copilot changed {s.aiLines.length} line{s.aiLines.length > 1 ? 's' : ''} · {s.aiNote}</span>
          <Secondary small onClick={() => { s.aiUndo?.(); usePine.setState({ aiLines: [] }); }}>Undo</Secondary>
        </div>
      )}
      {!reviewAll && s.banner?.kind === 'draft' && edited && (
        <div className="flex shrink-0 flex-col gap-0.5 bg-brand-tint px-3.5 py-2 text-label">
          <span className="font-semibold text-brand-text">Draft · not run yet</span>
          <span className="text-text-secondary">You closed the editor before running. Run to update the canvas.</span>
        </div>
      )}
      {!reviewAll && s.banner?.kind === 'conflict' && (
        <div className="flex shrink-0 flex-col gap-2 bg-warn-tint px-3.5 py-2.5 text-label">
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-warn-text">The canvas changed lines you’re editing</span>
            <span className="text-text-secondary">You changed a block while {s.banner.lines[1] > s.banner.lines[0] ? `lines ${s.banner.lines[0]}–${s.banner.lines[1]}` : `line ${s.banner.lines[0]}`} had edits that didn’t run.</span>
          </span>
          <span className="flex gap-2"><CardAction onClick={s.keepMine}>Keep my code</CardAction><Secondary onClick={s.useCanvasVersion}>Use the canvas version</Secondary></span>
        </div>
      )}

      {/* body */}
      {reviewAll ? (
        <ReviewAll />
      ) : (
        <div className="relative min-h-0 grow">
          <CodeEditor
            value={s.code}
            marks={marks}
            focus={s.focus}
            onChange={s.type}
            onRun={() => runOn && s.run()}
            onAcceptFix={acceptFix}
            onNextProblem={s.nextProblem}
            onFind={() => setFind({ q: find?.q ?? '', i: 0 })}
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
                if (m) usePine.setState({ focus: { line: s.code.slice(0, m.from).split('\n').length, n: Date.now() } });
              }}
              onClose={() => setFind(null)}
            />
          )}
          {/* toasts sit above the footer and never cover Run */}
          {s.toast && (
            <div role="status" className="absolute inset-x-3 bottom-3 z-10 flex animate-msg-in items-center gap-2.5 rounded-block border border-border-control bg-surface py-2 pr-2 pl-3 shadow-surface">
              <StatusIcon kind="done" />
              <span className="flex flex-1 flex-col">
                <span className="text-chip font-semibold">{s.toast.text}</span>
                {s.toast.sub && <span className="text-label text-text-tertiary">{s.toast.sub}</span>}
              </span>
              {s.toast.undo && <Secondary small onClick={s.toast.undo}>Undo</Secondary>}
            </div>
          )}
          <OneByOne />
        </div>
      )}

      {!reviewAll && s.problems.length >= 3 && !s.review && <SummaryBar />}

      {/* log strip */}
      {!reviewAll && (
        <div className="flex shrink-0 items-start gap-2.5 border-t border-border-divider bg-code-log px-3.5 py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {s.problems.length >= 3 && !s.logOpen ? (
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
                  {l.problemId && s.closed.includes(l.problemId) && (
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

      {/* footer: Discard on the left, Run on the right */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-t border-border-divider px-3.5">
        {reviewAll ? (
          <>
            <Secondary onClick={s.closeReview}>Cancel</Secondary>
            <span className="flex-1" />
            <button type="button" onClick={s.applyReview} disabled={!s.review || (s.review.mode === 'all' && !s.review.selected.length)} className="inline-flex h-8 items-center gap-2 rounded-chip bg-brand px-3.5 text-body font-medium text-text-on-brand outline-none hover:bg-brand-pressed focus-visible:shadow-focus-ring disabled:bg-surface-disabled disabled:text-text-disabled">
              Apply {s.review?.mode === 'all' ? s.review.selected.length : ''} &amp; run <span className="font-mono text-[10.5px] opacity-70">⌘↵</span>
            </button>
          </>
        ) : (
          <>
            <span title={changes ? `Back to when you opened the editor · ${changes} change${changes > 1 ? 's' : ''}` : 'Nothing has changed since you opened the editor'}>
              <Secondary disabled={!changes} onClick={s.discard}>Discard changes</Secondary>
            </span>
            <span className="flex-1" />
            {/* the panel's one filled-blue button */}
            <button
              type="button"
              onClick={() => s.run()}
              disabled={!runOn}
              aria-busy={s.running || undefined}
              title={runOn ? 'Run (⌘↵)' : 'Nothing new to run'}
              className="inline-flex h-8 items-center gap-2 rounded-chip bg-brand px-3.5 text-body font-medium text-text-on-brand outline-none hover:bg-brand-pressed active:bg-brand-pressed focus-visible:shadow-focus-ring disabled:bg-surface-disabled disabled:text-text-disabled aria-busy:bg-brand aria-busy:text-text-on-brand"
            >
              {s.running ? <><Spinner light /> Running…</> : <>Run <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg><span className="font-mono text-[10.5px] opacity-70">⌘↵</span></>}
            </button>
          </>
        )}
      </div>

      {/* Ask Copilot */}
      <div className="shrink-0 border-t border-border-divider px-3.5 pt-2.5 pb-3">
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-border-control bg-surface pr-1.5 pl-3 focus-within:shadow-focus-ring">
          <Spark size={12} />
          <input
            aria-label="Ask Copilot about the code"
            value={ask}
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
            className={`flex size-7 items-center justify-center rounded-full transition-colors ${!ask.trim() ? 'bg-surface-selected text-text-subtle' : runOn ? 'border border-brand bg-surface text-brand' : 'bg-brand text-text-on-brand'}`}
          >
            <Ico d={I.send} size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
