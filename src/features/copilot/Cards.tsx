import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { describeCondition, flatConditions } from '@/lib/conditions';
import { exitFor, NEXT_STEPS } from '@/mock/copilot';
import { lineOfVar } from '@/lib/pine';
import { useCanvas } from '@/store/canvas';
import { usePine } from '@/store/pine';
import { EXIT_OPTIONS, VAGUE_OPTIONS, useCopilot, type Card } from '@/store/copilot';
import { useWorkspace } from '@/store/workspace';
import type { Condition, Operand } from '@/types/strategy';
import { AnswerOption, AssumedChip, CardAction, CodeGlyph, ContextChip, DiffMark, FitBadge, FollowUpChip, Secondary, SignalCounts, Spark, StatusIcon, Tertiary, ValueChip } from './parts';

/*
  The AI card (design/copilot · Molecules + card states, FIXES.md). One card per request;
  it changes state in place and never stacks a new card per step.
  Layout: header 10/12 · section labels · rows 5/12 (first row flush left, joiners inline) ·
  grey insets 12 from the edge · footer one row: note · link · Undo. The footer never repeats the title.
*/

/* ── Conditions as rows of chips ───────────────────────────────── */

const RELATION_WORDS: Record<string, string> = {
  'Cross Above': 'crosses above', 'Cross Below': 'crosses below', 'Greater Than': 'above', 'Greater Than or Equal': 'at or above',
  'Less Than': 'below', 'Less Than or Equal': 'at or below', Equals: 'equals', 'Not Equal': 'is not',
};

function word(o: Operand): string {
  if (o.type === 'number') return String(o.value);
  const p = o.params;
  switch (o.id) {
    case 'price': return p.source ?? 'Close';
    case 'volume': return 'Volume';
    case 'vwap': return 'VWAP';
    case 'rsi': return p.offset ? 'RSI (previous candle)' : 'RSI';
    case 'stoch': return 'Stochastic';
    case 'bb': return `Bollinger ${p.band?.toLowerCase()} band`;
    case 'sma': return p.source === 'Volume' ? `SMA ${p.length} of Volume` : `MA ${p.length}`;
    default: return `${o.id.toUpperCase()} ${p.length}`;
  }
}

const JOINER = 'text-[10.5px] font-semibold tracking-[0.04em] text-text-subtle';

/** The chips of one condition, inline (for rows and diff lines). */
function Chips({ c }: { c: Condition }) {
  const openEditor = useCanvas((s) => s.openEditor);
  if (c.custom) return <><CodeGlyph /> {c.custom.text}</>;
  const assumed = c.left?.type === 'indicator' && c.left.id === 'rsi' && c.left.params.length === 14;
  return (
    <>
      {c.left && <ValueChip>{word(c.left)}</ValueChip>}
      {c.relation ? RELATION_WORDS[c.relation] : '…'}
      {c.right && <ValueChip>{word(c.right)}</ValueChip>}
      {c.right?.math && <ValueChip>{c.right.math.op} {c.right.math.value}</ValueChip>}
      {/* clicking an assumed detail opens that setting on the canvas */}
      {assumed && <AssumedChip onClick={() => openEditor(c.id, 'leftSettings')}>length 14 · assumed</AssumedChip>}
    </>
  );
}

/** One condition row. Hovering it rings its block on the canvas (and the other way round). */
function Row({ c, joiner }: { c: Condition; joiner?: string }) {
  const linked = useCanvas((s) => s.linkedHover === c.id);
  const onCanvas = useCanvas((s) => [...flatConditions(s.entry), ...flatConditions(s.exit)].some((x) => x.id === c.id));
  const set = useCanvas((s) => s.set);
  return (
    <div
      onMouseEnter={() => onCanvas && set({ linkedHover: c.id })}
      onMouseLeave={() => set({ linkedHover: null })}
      className={`flex flex-wrap items-center gap-1.5 px-3 py-[5px] text-chip text-text-secondary ${linked && onCanvas ? 'bg-surface-hover' : ''}`}
    >
      {joiner && <span className={JOINER}>{joiner}</span>}
      <Chips c={c} />
    </div>
  );
}

/** ENTRY / EXIT, with the timing chip beside it. */
const Section = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-text-subtle">{children}</div>
);

function ContextRow() {
  const w = useWorkspace();
  const kind = { spot: 'Spot', option: 'Option', perpetual: 'Perpetual', synthetic: 'Synthetic', combined: 'Combined' }[w.chartData.kind] ?? 'Spot';
  return <div className="flex gap-1.5 px-3 pb-1"><ContextChip>{w.instrument}</ContextChip><ContextChip>{kind}</ContextChip><ContextChip>{w.timeframe}</ContextChip></div>;
}

/** Entry rows, then the exit (or the slot for its question). */
function Understood({ entry, exit, logic = 'ALL OF', children }: { entry: Condition[]; exit?: Condition | null; logic?: string; children?: ReactNode }) {
  const openEditor = useCanvas((s) => s.openEditor);
  return (
    <>
      <Section>ENTRY <AssumedChip onClick={() => openEditor('timing:entry', 'more')}>On candle close</AssumedChip></Section>
      {entry.map((c, i) => <Row key={c.id} c={c} joiner={i ? logic : undefined} />)}
      {exit !== undefined && (
        <>
          <Section>EXIT</Section>
          {exit && <Row c={exit} />}
          {children}
        </>
      )}
    </>
  );
}

/* ── Card shell and its parts ──────────────────────────────────── */

/**
 * A card in an older chat is a record (design/copilot/CONVERSATIONS.md): its actions are removed
 * and a date chip sits on the right of the header ("Applied · 2 Nov").
 */
const RecordContext = createContext<string | null>(null);
const DateChip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-[5px] bg-surface-selected px-1.5 text-[11px] font-medium text-text-secondary">{children}</span>
);

function Shell({ icon, title, sub, badge, error, children, footer }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; badge?: ReactNode; error?: boolean; children?: ReactNode; footer?: ReactNode }) {
  const record = useContext(RecordContext);
  if (record) {
    badge = <DateChip>{record}</DateChip>;
    footer = undefined;
  }
  return (
    <article className={`flex flex-col overflow-hidden rounded-card border bg-surface ${error ? 'border-error-card' : 'border-border-control'}`}>
      <header className="flex items-center gap-2 px-3 py-2.5 text-body font-semibold">
        {icon}
        <span className="flex flex-1 flex-col gap-px">
          <span key={String(title)} className="animate-fade-in">{title}</span>
          {sub && <span className="text-label font-normal text-text-tertiary">{sub}</span>}
        </span>
        {badge}
      </header>
      {children}
      {footer && <footer className="flex animate-fade-in flex-wrap items-center gap-2 border-t border-border-subtle px-3 py-2.5">{footer}</footer>}
    </article>
  );
}

/** The muted note on the left of a footer. */
const Note = ({ children }: { children: ReactNode }) => <span className="flex-1 text-label text-text-tertiary">{children}</span>;

/** Footer after Copilot added something: "Pine Script updated · View code · Undo". */
function AddedFooter({ onUndo, note = 'Pine Script updated', link = 'View code', onLink }: { onUndo: () => void; note?: string; link?: string; onLink?: () => void }) {
  const setView = useCopilot((s) => s.setView);
  return (
    <>
      <Note>{note}</Note>
      <Tertiary onClick={onLink ?? (() => setView('pine'))}>{link}</Tertiary>
      <Secondary small onClick={onUndo}>Undo</Secondary>
    </>
  );
}

function Proof({ entries, exits, beforeEntries, note }: { entries: number; exits?: number; beforeEntries?: number; note?: string }) {
  const period = useWorkspace((s) => s.period);
  const checkOnChart = useCopilot((s) => s.checkOnChart);
  // a record keeps what it did, not the live numbers
  if (useContext(RecordContext)) return null;
  return (
    <div className="mx-3 mt-1.5 mb-3 flex animate-fade-in items-center gap-2.5 rounded-lg bg-surface-hover px-3 py-2.5">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[11px] text-text-tertiary">Signals in the last {period}</span>
        <SignalCounts entries={entries} exits={exits} beforeEntries={beforeEntries} />
        {note && <span className="text-label text-text-tertiary">{note}</span>}
      </div>
      <CardAction onClick={checkOnChart}>Check on chart</CardAction>
    </div>
  );
}

/** A grey strip inside a card: the review impact, what a failure kept. */
const Strip = ({ children, className = 'mt-1 mb-2.5' }: { children: ReactNode; className?: string }) => (
  <div className={`mx-3 flex items-center gap-2 rounded-lg bg-surface-hover px-2.5 py-2 text-chip text-text-secondary tabular-nums ${className}`}>{children}</div>
);

/** The question box (grey inset with answer options). */
const Question = ({ title, children }: { title: string; children: ReactNode }) => useContext(RecordContext) ? null : (
  <div className="mx-3 mt-1 mb-3 flex animate-fade-in flex-col gap-2 rounded-[10px] bg-surface-hover p-3">
    <span className="text-body font-medium text-text-primary">{title}</span>
    {children}
  </div>
);

/* ── One card, any state ───────────────────────────────────────── */

export function CopilotCard({ card, last, record }: { card: Card; last: boolean; record?: string }) {
  return (
    <RecordContext.Provider value={record ?? null}>
      <CardBody card={card} last={last && !record} />
    </RecordContext.Provider>
  );
}

function CardBody({ card, last }: { card: Card; last: boolean }) {
  const cp = useCopilot();
  const period = useWorkspace((s) => s.period);
  // where the custom logic sits in the code right now
  const customLine = usePine((s) => lineOfVar(s.ran.split('\n'), 'dipped')) || 5;
  switch (card.kind) {
    case 'main': {
      const n = card.entry.length;
      const q = card.question;
      const question = q && card.phase !== 'ready' && (
        <Question title="How should it exit?">
          {EXIT_OPTIONS.map((o, i) => (
            <AnswerOption key={o.label} label={i === 0 ? exitFor(card.entry).label : o.label} suggested={o.suggested} chosen={q.chosen === i} disabled={q.chosen !== null && q.chosen !== i} onClick={() => cp.answer(card.id, i)} />
          ))}
        </Question>
      );
      if (card.phase === 'thinking')
        return <Thinking text="Reading your idea" />;
      if (card.phase === 'understood')
        return (
          <Shell icon={<Spark />} title="Here’s what I understood">
            <ContextRow />
            <Understood entry={card.entry} exit={null}>{question}</Understood>
          </Shell>
        );
      if (card.phase === 'building')
        return (
          <Shell icon={<Spark />} title="Building on canvas">
            <ContextRow />
            <Understood entry={card.entry} exit={card.exit ?? null}>{question}</Understood>
            <div className="mt-1.5 flex items-center gap-2.5 px-3 pb-2.5">
              <StatusIcon kind="working" />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-body font-semibold">Adding {card.exit ? 'the exit' : 'entry conditions'} to canvas…</span>
                <span className="text-label text-text-tertiary tabular-nums">{Math.min(card.placed + 1, n)} of {n} placed</span>
              </div>
              <Secondary onClick={cp.stop}>Stop</Secondary>
            </div>
            <div className="h-[3px] bg-brand-pressed-tint">
              <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${(Math.min(card.placed + 1, n) / n) * 100}%` }} />
            </div>
          </Shell>
        );
      if (card.phase === 'stopped')
        return (
          <Shell icon={<StatusIcon kind="stopped" />} title={`Stopped · ${card.placed} of ${n} placed`} sub="What’s placed stays on the canvas." footer={<><CardAction onClick={() => cp.resume(card.id)}>Continue</CardAction><span className="flex-1" /><Secondary small onClick={() => cp.undo(card.id)}>Undo</Secondary></>}>
            <Understood entry={card.entry} />
            <div className="h-1.5" />
          </Shell>
        );
      if (card.phase === 'applied')
        return (
          <Shell icon={<StatusIcon kind="done" />} title={`Added ${n} entry condition${n > 1 ? 's' : ''}`} sub="Entry on canvas · the exit needs your answer" footer={<AddedFooter onUndo={() => cp.undo(card.id)} />}>
            <Understood entry={card.entry} exit={null}>{question}</Understood>
            {card.counts && <Proof entries={card.counts.entries} />}
          </Shell>
        );
      return (
        <>
          <Shell icon={<StatusIcon kind="done" />} title="Strategy ready" sub={card.exitNote ? `Entry on canvas · ${card.exitNote.toLowerCase()}` : 'Entry and exit on canvas'} footer={<AddedFooter onUndo={() => cp.undo(card.id)} />}>
            <Understood entry={card.entry} exit={card.exit} />
            {card.counts && <Proof entries={card.counts.entries} exits={card.exit ? card.counts.exits : undefined} />}
          </Shell>
          {last && <span className="flex flex-wrap gap-2">{NEXT_STEPS.map((s) => <FollowUpChip key={s} onClick={() => (s.startsWith('Looks right') ? cp.runBacktest() : cp.send(s))}>{s}</FollowUpChip>)}</span>}
        </>
      );
    }

    case 'refineAdd':
      return (
        <Shell icon={<StatusIcon kind="done" />} title={`Added 1 condition to ${card.side === 'exit' ? 'Exit' : 'Entry'}`} sub={card.added.left && card.added.right ? `${word(card.added.left)} ${RELATION_WORDS[card.added.relation ?? 'Greater Than']} ${word(card.added.right)}` : undefined} footer={<AddedFooter onUndo={() => cp.undo(card.id)} />}>
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-chip text-text-secondary"><DiffMark kind="added" /><Chips c={card.added} /></div>
          <Proof entries={card.after.entries} exits={card.side === 'exit' ? card.after.exits : undefined} beforeEntries={card.before.entries} note={card.after.entries < card.before.entries ? `Volume filter removed ${card.before.entries - card.after.entries} weak signal${card.before.entries - card.after.entries > 1 ? 's' : ''}` : undefined} />
        </Shell>
      );

    case 'review': {
      const done = card.phase === 'applied';
      const rows = (
        <>
          {card.change && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-chip text-text-secondary">
              <DiffMark kind="changed" />
              <ValueChip>RSI 14</ValueChip>above
              <span className="inline-flex items-center gap-1"><s className="text-text-subtle">{card.change.from}</s><ValueChip>{card.change.to}</ValueChip></span>
            </div>
          )}
          {card.removal && (
            <div className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-chip ${done ? 'text-text-subtle line-through' : 'text-text-secondary'}`}>
              <DiffMark kind="removed" />
              {card.removal.left && card.removal.right ? `${word(card.removal.left)} ${RELATION_WORDS[card.removal.relation ?? 'Greater Than']} ${word(card.removal.right)}` : describeCondition(card.removal)}
            </div>
          )}
          <Strip>Entries in {period}: <b className="font-semibold text-text-primary">{card.before} → {card.after}</b></Strip>
        </>
      );
      if (done)
        return <Shell icon={<StatusIcon kind="done" />} title="Applied 2 changes" sub="Changed on the canvas" footer={<AddedFooter onUndo={() => cp.undo(card.id)} />}>{rows}</Shell>;
      if (card.phase === 'cancelled')
        return <Shell icon={<Spark />} title="Kept your blocks as they are" sub="Nothing changed on the canvas." />;
      return (
        <Shell icon={<StatusIcon kind="needs" />} title={`${(card.change ? 1 : 0) + (card.removal ? 1 : 0)} changes to blocks you made`} sub="The canvas shows them. Nothing changes until you apply." footer={<><Secondary onClick={() => cp.cancelReview(card.id)}>Cancel</Secondary><span className="flex-1" /><CardAction onClick={() => cp.applyReview(card.id)}>Apply changes</CardAction></>}>
          {rows}
        </Shell>
      );
    }

    case 'fit':
      if (card.phase === 'check')
        return (
          <Shell icon={<StatusIcon kind="needs" />} title="1 of 2 conditions needs custom logic" sub="Decided before anything goes on the canvas." footer={<><CardAction onClick={() => cp.buildAnyway(card.id)}>Build anyway</CardAction><Tertiary onClick={() => cp.simplify(card.id)}>Simplify so it fits</Tertiary></>}>
            <div className="flex items-center gap-2 px-3 py-[5px] text-chip text-text-secondary"><span className="flex flex-1 flex-wrap items-center gap-1.5"><ValueChip>RSI 14</ValueChip>crosses above<ValueChip>60</ValueChip></span><FitBadge kind="fits" /></div>
            <div className="flex items-center gap-2 px-3 py-[5px] text-chip text-text-secondary"><span className="flex-1">RSI was below 40 in the last 10 candles</span><FitBadge kind="custom" /></div>
            <p className="m-0 px-3 pt-1 pb-3 text-label leading-[17px] text-text-tertiary">The canvas can’t draw “at least once in the last N candles”. It becomes one Custom logic block that runs on code. You can still check it on the chart.</p>
          </Shell>
        );
      return (
        <Shell
          icon={<StatusIcon kind="done" />}
          title="Added to canvas"
          sub={card.phase === 'built' ? '1 custom block · exit when RSI drops below 50' : 'Simplified: RSI was below 40 on the previous candle'}
          footer={card.phase === 'built'
            ? <AddedFooter note={`Custom logic is line ${customLine} in Pine Script`} link="Open" onLink={() => cp.openLine(customLine)} onUndo={() => cp.undo(card.id)} />
            : <AddedFooter onUndo={() => cp.undo(card.id)} />}
        >
          <Section>ENTRY</Section>
          {card.phase === 'built' ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-[5px] text-chip text-text-secondary"><ValueChip>RSI 14</ValueChip>crosses above<ValueChip>60</ValueChip></div>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-[5px] text-chip text-text-secondary"><span className={JOINER}>ALL OF</span><CodeGlyph /> RSI below 40 in last 10 candles</div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-[5px] text-chip text-text-secondary"><ValueChip>RSI 14</ValueChip>crosses above<ValueChip>60</ValueChip></div>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-[5px] text-chip text-text-secondary"><span className={JOINER}>ALL OF</span><ValueChip>RSI (previous candle)</ValueChip>below<ValueChip>40</ValueChip></div>
            </>
          )}
          {card.counts && <Proof entries={card.counts.entries} exits={card.counts.exits} />}
        </Shell>
      );

    case 'codeOnly':
      return (
        <Shell icon={<Spark />} title="This one runs from code" badge={<FitBadge kind="code" />} footer={<><CardAction onClick={() => cp.setView('pine')}>Open code</CardAction><Secondary onClick={cp.checkOnChart}>Check on chart</Secondary></>}>
          <p className="m-0 px-3 pb-3 text-chip leading-[18px] text-text-secondary">It needs memory between candles (“armed” until RSI drops below 40). The canvas can’t draw that, so the whole strategy runs from Pine Script. The chart shows exactly when it trades.</p>
        </Shell>
      );

    case 'failed':
      if (card.phase === 'thinking') return <Thinking text="Building on canvas" />;
      if (card.phase === 'skipped')
        return <Shell icon={<StatusIcon kind="done" />} title={`Entry added · ${card.entryCount} conditions`} sub="No exit yet. Add one on the canvas when you’re ready." footer={<AddedFooter onUndo={() => cp.undo(card.id)} />} />;
      // one card: what was kept is a grey row inside it
      return (
        <Shell
          error
          icon={<StatusIcon kind="failed" />}
          title="Couldn’t add the 15:15 time exit"
          sub="Your entry is saved. Nothing else changed."
          footer={<><CardAction onClick={() => cp.retryFailed(card.id)}>Try again</CardAction><Secondary onClick={cp.addExitOnCanvas}>Add it on canvas</Secondary><Tertiary onClick={() => cp.skipExit(card.id)}>Skip exit</Tertiary></>}
        >
          <Strip className="mb-2.5"><span className="scale-[0.8]"><StatusIcon kind="done" /></span><span className="flex-1 text-text-primary">Entry added · {card.entryCount} conditions</span><Secondary small onClick={() => cp.undo(card.id)}>Undo</Secondary></Strip>
          <div className="px-3 pb-2.5 text-label text-text-tertiary">
            <button type="button" onClick={() => cp.toggleDetails(card.id)} aria-expanded={card.detailsOpen} className="hover:text-text-primary">
              {card.detailsOpen ? '▾' : '▸'} Details for support
            </button>
            {card.detailsOpen && <code className="mt-1.5 block rounded-chip bg-surface-hover p-2 font-mono text-[11px] text-text-secondary">Time exits need a square-off time in the setup; none is set. ref #A41-7C</code>}
          </div>
        </Shell>
      );

    case 'vague':
      return (
        <Shell icon={<Spark />} title="Which style do you want to trade?" sub="Pick one and I’ll build it. You can change anything after.">
          <div className="flex flex-col gap-2 px-3 pt-1 pb-2">
            {VAGUE_OPTIONS.map((o, i) => (
              <AnswerOption key={o.label} label={o.label} hint={o.hint} chosen={card.chosen === i} disabled={card.chosen !== null && card.chosen !== i} onClick={() => cp.pickVague(card.id, i)} />
            ))}
            <AnswerOption label="I’ll describe my own idea" chosen={card.chosen === 3} disabled={card.chosen !== null && card.chosen !== 3} onClick={() => { cp.pickVague(card.id, 3); document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Copilot"]')?.focus(); }} />
          </div>
          <p className="m-0 px-3 pb-3 text-label text-text-tertiary">No strategy is guaranteed to profit. The backtest shows how it did in the past.</p>
        </Shell>
      );

    case 'note':
      return <TextReply text={card.text} />;

    case 'answer':
      return (
        <Shell icon={<StatusIcon kind="done" />} title={card.title} sub={card.sub}>
          <p className="m-0 px-3 pb-3 text-chip leading-[18px] text-text-secondary">{card.text}</p>
        </Shell>
      );

    // after about 50 turns: a fresh chat stays quick
    case 'long':
      if (card.dismissed) return null;
      return (
        <Shell icon={<Spark />} title="This chat is getting long" sub="A fresh chat stays quick. I’ll keep what we decided." footer={<><CardAction onClick={cp.newChat}>Start a fresh chat</CardAction><Secondary onClick={() => cp.keepGoing(card.id)}>Keep going</Secondary></>} />
      );
  }
}

/* ── Plain replies: words, like a chat (no card box) ───────────── */

/** ✦ and three soft dots while a reply is on its way. */
export function Thinking({ text }: { text?: string }) {
  return (
    <div className="flex animate-msg-in items-center gap-2 py-1 text-label text-text-muted" aria-live="polite">
      <Spark />
      {text && <span>{text}</span>}
      <span className="flex gap-1" aria-label="Copilot is thinking">
        {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-typing rounded-full bg-text-tertiary" style={{ animationDelay: `${i * 160}ms` }} />)}
      </span>
    </div>
  );
}

/** The answer streams in word by word, then stays put. */
function TextReply({ text }: { text: string }) {
  const words = text.split(' ');
  // an older chat's answer is already written
  const [shown, setShown] = useState(useContext(RecordContext) ? words.length : 1);
  useEffect(() => {
    if (shown >= words.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 28);
    return () => clearTimeout(t);
  }, [shown, words.length]);
  return (
    <div className="flex gap-2 text-body leading-[1.55] text-text-primary">
      <span className="pt-1"><Spark /></span>
      <p className="m-0">{words.slice(0, shown).join(' ')}</p>
    </div>
  );
}
