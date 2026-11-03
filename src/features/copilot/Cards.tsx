import { useEffect, useState, type ReactNode } from 'react';
import { describeCondition, flatConditions } from '@/lib/conditions';
import { exitFor, NEXT_STEPS } from '@/mock/copilot';
import { useCanvas } from '@/store/canvas';
import { EXIT_OPTIONS, VAGUE_OPTIONS, useCopilot, type Card } from '@/store/copilot';
import { useWorkspace } from '@/store/workspace';
import type { Condition, Operand } from '@/types/strategy';
import { AnswerOption, AssumedChip, CardAction, ContextChip, DiffMark, FitBadge, FollowUpChip, SignalCounts, SmallSecondary, Spark, StatusIcon, ValueChip } from './parts';

/*
  The AI card (design/copilot · Molecules + card states). One card per request;
  it changes state in place and never stacks a new card per step.
*/

/* ── Conditions as sentences of chips ──────────────────────────── */

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

function Sentence({ c }: { c: Condition }) {
  const openEditor = useCanvas((s) => s.openEditor);
  if (c.custom) return <span className="text-label">{c.custom.text}</span>;
  const assumed = c.left?.type === 'indicator' && c.left.id === 'rsi' && c.left.params.length === 14;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-label">
      {c.left && <ValueChip>{word(c.left)}</ValueChip>}
      <span className="text-text-secondary">{c.relation ? RELATION_WORDS[c.relation] : '…'}</span>
      {c.right && <ValueChip>{word(c.right)}</ValueChip>}
      {c.right?.math && <ValueChip>{c.right.math.op} {c.right.math.value}</ValueChip>}
      {/* clicking an assumed detail opens that setting on the canvas */}
      {assumed && <AssumedChip onClick={() => openEditor(c.id, 'leftSettings')}>length 14 · assumed</AssumedChip>}
    </span>
  );
}

/** One row of "what I understood". Hovering it rings its block on the canvas (and the other way round). */
function Row({ c, label }: { c: Condition; label?: string }) {
  const linked = useCanvas((s) => s.linkedHover === c.id);
  const onCanvas = useCanvas((s) => [...flatConditions(s.entry), ...flatConditions(s.exit)].some((x) => x.id === c.id));
  const set = useCanvas((s) => s.set);
  return (
    <div
      onMouseEnter={() => onCanvas && set({ linkedHover: c.id })}
      onMouseLeave={() => set({ linkedHover: null })}
      className={`-mx-1.5 flex items-start gap-2 rounded-chip px-1.5 py-1 ${linked && onCanvas ? 'bg-surface-hover' : ''}`}
    >
      <span className="w-12 shrink-0 pt-0.5 text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary">{label ?? ''}</span>
      <span className="grow"><Sentence c={c} /></span>
      {linked && onCanvas && <span className="shrink-0 pt-0.5 text-[11px] text-brand">Shown on canvas</span>}
    </div>
  );
}

function Understood({ entry, exit }: { entry: Condition[]; exit?: Condition | null }) {
  const w = useWorkspace();
  const openEditor = useCanvas((s) => s.openEditor);
  const kind = { spot: 'Spot', option: 'Option', perpetual: 'Perpetual', synthetic: 'Synthetic', combined: 'Combined' }[w.chartData.kind] ?? 'Spot';
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex gap-1.5"><ContextChip>{w.instrument}</ContextChip><ContextChip>{kind}</ContextChip><ContextChip>{w.timeframe}</ContextChip></span>
      <span className="mt-1 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary">
        ENTRY <AssumedChip onClick={() => openEditor('timing:entry', 'more')}>On candle close</AssumedChip>
      </span>
      {entry.map((c, i) => <Row key={c.id} c={c} label={i ? 'ALL OF' : undefined} />)}
      {exit !== undefined && (
        <>
          <span className="mt-1 text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary">EXIT</span>
          {exit && <Row c={exit} />}
        </>
      )}
    </div>
  );
}

/* ── Card shell and its inset parts ────────────────────────────── */

function Shell({ icon, title, sub, error, children, footer }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; error?: boolean; children?: ReactNode; footer?: ReactNode }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-card border bg-surface ${error ? 'border-error-card' : 'border-border-control'}`}>
      <header className="flex items-start gap-2 px-3.5 pt-3">
        <span className="pt-0.5">{icon}</span>
        <span className="flex flex-col">
          <span key={String(title)} className="animate-fade-in text-body font-semibold">{title}</span>
          {sub && <span className="text-label text-text-muted">{sub}</span>}
        </span>
      </header>
      {children && <div className="flex flex-col gap-3 px-3.5 pt-2.5 pb-3.5">{children}</div>}
      {footer && <footer className="flex animate-fade-in flex-wrap items-center gap-2 border-t border-border-subtle px-3.5 py-2.5">{footer}</footer>}
    </article>
  );
}

const Inset = ({ children }: { children: ReactNode }) => <div className="flex animate-fade-in flex-col gap-2 rounded-[10px] bg-surface-hover p-3">{children}</div>;

function Proof({ entries, exits, beforeEntries, note }: { entries: number; exits?: number; beforeEntries?: number; note?: string }) {
  const period = useWorkspace((s) => s.period);
  const checkOnChart = useCopilot((s) => s.checkOnChart);
  return (
    <Inset>
      <span className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Signals in the last {period}</span>
          <SignalCounts entries={entries} exits={exits} beforeEntries={beforeEntries} />
          {note && <span className="text-label text-text-tertiary">{note}</span>}
        </span>
        <CardAction onClick={checkOnChart}>Check on chart</CardAction>
      </span>
    </Inset>
  );
}

const Applied = ({ text = 'Added to canvas', onUndo }: { text?: string; onUndo: () => void }) => (
  <>
    <StatusIcon kind="done" />
    <span className="grow text-label font-medium">{text}</span>
    <SmallSecondary onClick={onUndo}>Undo</SmallSecondary>
  </>
);

/* ── One card, any state ───────────────────────────────────────── */

export function CopilotCard({ card, last }: { card: Card; last: boolean }) {
  const cp = useCopilot();
  switch (card.kind) {
    case 'main': {
      const n = card.entry.length;
      const q = card.question;
      const question = q && card.phase !== 'ready' && (
        <Inset>
          <span className="text-body font-medium">How should it exit?</span>
          {EXIT_OPTIONS.map((o, i) => (
            <AnswerOption key={o.label} label={i === 0 ? exitFor(card.entry).label : o.label} suggested={o.suggested} chosen={q.chosen === i} disabled={q.chosen !== null && q.chosen !== i} onClick={() => cp.answer(card.id, i)} />
          ))}
        </Inset>
      );
      if (card.phase === 'thinking')
        return <Thinking text="Reading your idea" />;
      if (card.phase === 'understood')
        return (
          <Shell icon={<Spark />} title="Here’s what I understood">
            <Understood entry={card.entry} exit={null} />
            {question}
          </Shell>
        );
      if (card.phase === 'building')
        return (
          <Shell icon={<Spark />} title="Building on canvas">
            <Understood entry={card.entry} exit={card.exit ?? null} />
            {question}
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2.5">
                <StatusIcon kind="working" />
                <span className="flex grow flex-col">
                  <span className="text-body font-semibold">Adding {card.exit ? 'the exit' : 'entry conditions'} to canvas…</span>
                  <span className="text-label text-text-muted">{Math.min(card.placed, n)} of {n} placed</span>
                </span>
                <SmallSecondary onClick={cp.stop}>Stop</SmallSecondary>
              </span>
              <div className="h-[3px] overflow-hidden rounded-full bg-brand-tint">
                <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${(Math.min(card.placed + 0.5, n) / n) * 100}%` }} />
              </div>
            </div>
          </Shell>
        );
      if (card.phase === 'stopped')
        return (
          <Shell icon={<StatusIcon kind="stopped" />} title={`Stopped · ${card.placed} of ${n} placed`} footer={<><CardAction onClick={() => cp.resume(card.id)}>Continue</CardAction><SmallSecondary onClick={() => cp.undo(card.id)}>Undo</SmallSecondary></>}>
            <Understood entry={card.entry} />
          </Shell>
        );
      if (card.phase === 'applied')
        return (
          <Shell icon={<StatusIcon kind="done" />} title={`Added ${n} entry condition${n > 1 ? 's' : ''}`} sub={card.counts ? `${card.counts.entries} ${card.counts.entries === 1 ? 'entry' : 'entries'} in the last ${useWorkspace.getState().period}` : undefined} footer={<Applied onUndo={() => cp.undo(card.id)} />}>
            <Understood entry={card.entry} exit={null} />
            {question}
            {card.counts && <Proof entries={card.counts.entries} />}
          </Shell>
        );
      return (
        <>
          <Shell icon={<StatusIcon kind="done" />} title="Strategy ready" sub={card.exitNote ? `Entry on canvas · ${card.exitNote.toLowerCase()}` : 'Entry and exit on canvas'} footer={<Applied onUndo={() => cp.undo(card.id)} />}>
            <Understood entry={card.entry} exit={card.exit} />
            {card.counts && <Proof entries={card.counts.entries} exits={card.exit ? card.counts.exits : undefined} />}
          </Shell>
          {last && <span className="flex flex-wrap gap-2">{NEXT_STEPS.map((s) => <FollowUpChip key={s} onClick={() => (s.startsWith('Looks right') ? cp.runBacktest() : cp.send(s))}>{s}</FollowUpChip>)}</span>}
        </>
      );
    }

    case 'refineAdd':
      return (
        <Shell
          icon={<StatusIcon kind="done" />}
          title={`Added 1 condition to ${card.side === 'exit' ? 'Exit' : 'Entry'}`}
          footer={<><span className="grow text-label text-text-secondary">Pine Script updated</span><SmallSecondary tertiary onClick={() => cp.setView('pine')}>View code</SmallSecondary><SmallSecondary onClick={() => cp.undo(card.id)}>Undo</SmallSecondary></>}
        >
          <span className="flex items-center gap-2"><DiffMark kind="added" /><Sentence c={card.added} /></span>
          <Proof entries={card.after.entries} exits={card.side === 'exit' ? card.after.exits : undefined} beforeEntries={card.before.entries} note={card.after.entries < card.before.entries ? `Volume filter removed ${card.before.entries - card.after.entries} weak signal${card.before.entries - card.after.entries > 1 ? 's' : ''}` : undefined} />
        </Shell>
      );

    case 'review': {
      const rows = (
        <div className="flex flex-col gap-2">
          {card.change && (
            <span className="flex items-center gap-2 text-label">
              <DiffMark kind="changed" />
              <ValueChip>RSI 14</ValueChip> above <ValueChip><s className="mr-1 text-text-subtle">{card.change.from}</s>{card.change.to}</ValueChip>
            </span>
          )}
          {card.removal && (
            <span className={`flex items-center gap-2 text-label ${card.phase === 'applied' ? 'text-text-subtle line-through' : ''}`}>
              <DiffMark kind="removed" />
              {describeCondition(card.removal).replace('Greater Than', 'above')}
            </span>
          )}
          <span className="text-label text-text-secondary">Entries in {useWorkspace.getState().period}: <b className="font-semibold tabular-nums">{card.before} → {card.after}</b></span>
        </div>
      );
      if (card.phase === 'applied')
        return <Shell icon={<StatusIcon kind="done" />} title="Applied 2 changes" footer={<Applied text="Changed on canvas" onUndo={() => cp.undo(card.id)} />}>{rows}</Shell>;
      if (card.phase === 'cancelled')
        return <Shell icon={<Spark />} title="Kept your blocks as they are" sub="Nothing changed on the canvas." />;
      return (
        <Shell icon={<StatusIcon kind="needs" />} title={`${(card.change ? 1 : 0) + (card.removal ? 1 : 0)} changes to blocks you made`} sub="The canvas shows them. Nothing changes until you apply." footer={<><SmallSecondary onClick={() => cp.cancelReview(card.id)}>Cancel</SmallSecondary><span className="grow" /><CardAction onClick={() => cp.applyReview(card.id)}>Apply changes</CardAction></>}>
          {rows}
        </Shell>
      );
    }

    case 'fit':
      if (card.phase === 'check')
        return (
          <Shell icon={<StatusIcon kind="needs" />} title="1 of 2 conditions needs custom logic" footer={<><CardAction onClick={() => cp.buildAnyway(card.id)}>Build anyway</CardAction><SmallSecondary tertiary onClick={() => cp.simplify(card.id)}>Simplify so it fits</SmallSecondary></>}>
            <span className="flex items-center justify-between gap-2 text-label">RSI 14 crosses above 60 <FitBadge kind="fits" /></span>
            <div className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2 text-label">RSI was below 40 in the last 10 candles <FitBadge kind="custom" /></span>
              <span className="text-label text-text-tertiary">The canvas can’t draw “at least once in the last N candles”. It becomes one Custom logic block that runs on code. You can still check it on the chart.</span>
            </div>
          </Shell>
        );
      return (
        <Shell icon={<StatusIcon kind="done" />} title="Added to canvas" sub={card.phase === 'built' ? '1 custom block · exit when RSI drops below 50' : 'Simplified: RSI was below 40 on the previous candle'} footer={<Applied onUndo={() => cp.undo(card.id)} />}>
          {card.counts && <Proof entries={card.counts.entries} exits={card.counts.exits} />}
          {card.phase === 'built' && (
            <span className="flex items-center gap-2 text-label text-text-secondary">
              Custom logic is line 5 in Pine Script <SmallSecondary tertiary onClick={() => cp.openLine(5)}>Open</SmallSecondary>
            </span>
          )}
        </Shell>
      );

    case 'codeOnly':
      return (
        <Shell icon={<Spark />} title="This one runs from code" footer={<><CardAction onClick={() => cp.setView('pine')}>Open code</CardAction><SmallSecondary tertiary onClick={cp.checkOnChart}>Check on chart</SmallSecondary></>}>
          <FitBadge kind="code" />
          <span className="text-label text-text-secondary">It needs memory between candles (“armed” until RSI drops below 40). The canvas can’t draw that, so the whole strategy runs from Pine Script. The chart shows exactly when it trades.</span>
        </Shell>
      );

    case 'failed':
      if (card.phase === 'thinking') return <Shell icon={<StatusIcon kind="working" />} title="Building on canvas…" sub="Adding the entry, then the exit." />;
      if (card.phase === 'skipped')
        return <Shell icon={<StatusIcon kind="done" />} title={`Entry added · ${card.entryCount} conditions`} sub="No exit yet. Add one on the canvas when you’re ready." footer={<Applied onUndo={() => cp.undo(card.id)} />} />;
      return (
        <>
          <Shell icon={<StatusIcon kind="done" />} title={`Entry added · ${card.entryCount} conditions`} />
          <Shell
            error
            icon={<StatusIcon kind="failed" />}
            title="Couldn’t add the 15:15 time exit"
            sub="Your entry is saved. Nothing else changed."
            footer={<><CardAction onClick={() => cp.retryFailed(card.id)}>Try again</CardAction><SmallSecondary onClick={cp.addExitOnCanvas}>Add it on canvas</SmallSecondary><SmallSecondary tertiary onClick={() => cp.skipExit(card.id)}>Skip exit</SmallSecondary></>}
          >
            <button type="button" onClick={() => cp.toggleDetails(card.id)} aria-expanded={card.detailsOpen} className="self-start text-label text-text-tertiary hover:text-text-primary">
              {card.detailsOpen ? '▾' : '▸'} Details for support
            </button>
            {card.detailsOpen && <code className="rounded-chip bg-surface-hover p-2 font-mono text-[11px] text-text-secondary">Time exits need a square-off time in the setup; none is set. ref #A41-7C</code>}
          </Shell>
        </>
      );

    case 'vague':
      return (
        <Shell icon={<Spark />} title="Which style do you want to trade?">
          {VAGUE_OPTIONS.map((o, i) => (
            <AnswerOption key={o.label} label={o.label} hint={o.hint} chosen={card.chosen === i} disabled={card.chosen !== null && card.chosen !== i} onClick={() => cp.pickVague(card.id, i)} />
          ))}
          <AnswerOption label="I’ll describe my own idea" chosen={card.chosen === 3} disabled={card.chosen !== null && card.chosen !== 3} onClick={() => { cp.pickVague(card.id, 3); document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Copilot"]')?.focus(); }} />
          <span className="text-label text-text-tertiary">No strategy is guaranteed to profit. The backtest shows how it did in the past.</span>
        </Shell>
      );

    case 'note':
      return <TextReply text={card.text} />;
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
  const [shown, setShown] = useState(1);
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
