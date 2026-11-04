import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { ArrowIcon, MicIcon, PlusIcon } from '@/components/ui/icons';
import { copilotTake, kiloRupees, resultsView, variantFor } from '@/lib/backtestData';
import { copilotStarters, mockUser } from '@/mock/copilot';
import { useBacktest } from '@/store/backtest';
import { useCopilot } from '@/store/copilot';
import { useLibrary } from '@/store/library';
import { ChatHistory } from './History';
import { strategyLabel } from './strategyLabel';
import { usePine } from '@/store/pine';
import { useStrategy } from '@/store/strategy';
import { CopilotCard, Thinking } from './Cards';
import { CardAction, CodeGlyph, Secondary, Spark, UserBubble } from './parts';
import { PineView } from './PineView';

/** Starters for a saved strategy (design/copilot/CONVERSATIONS.md · Strategy empty state). */
const SAVED_STARTERS = [
  { title: 'Fewer signals, please', hint: 'Tighten the entry so it trades less.' },
  { title: 'Add a stop loss', hint: 'Exit a losing trade at a set loss.' },
  { title: 'Why did March lose money?', hint: 'Explain the worst month in the backtest.' },
];

/** Right panel: Signals Copilot (design/copilot · Panel). 440px wide. */
export function CopilotPanel() {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;
  const mode = useStrategy((s) => s.mode);
  const active = useBacktest((s) => s.setups.find((x) => x.id === s.activeId));
  const { messages, view, listening, typing, send, stop, setView, newChat, set } = useCopilot();
  const building = messages.some((m) => m.kind === 'card' && ((m.card.kind === 'main' && (m.card.phase === 'building' || m.card.phase === 'thinking')) || (m.card.kind === 'failed' && m.card.phase === 'thinking')));
  const ready = mode === 'backtest' && active?.status === 'current' && active.results && !active.results.noTrades ? active : null;
  const thread = useRef<HTMLDivElement>(null);
  const hasThread = messages.length > 0;
  const codeDraft = usePine((p) => p.code !== p.ran);
  const [codeWidth, setCodeWidth] = useState(() => {
    try { return Math.min(640, Math.max(440, Number(localStorage.getItem('signals.codeWidth')) || 440)); } catch { return 440; }
  });
  const setWidth = (w: number) => {
    const v = Math.min(640, Math.max(440, Math.round(w)));
    setCodeWidth(v);
    try { localStorage.setItem('signals.codeWidth', String(v)); } catch { /* private window: not remembered */ }
  };
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = codeWidth;
    const move = (ev: PointerEvent) => setWidth(w0 + (x0 - ev.clientX));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const strategyId = useCopilot((s) => s.strategyId);
  const activeChat = useCopilot((s) => s.chats.find((c) => c.id === s.activeChatId));
  const saved = useLibrary((l) => l.strategies.find((x) => x.id === strategyId));
  const otherChat = activeChat && activeChat.strategyId !== strategyId && activeChat.strategyId !== null ? activeChat : null;
  const otherName = otherChat ? strategyLabel(otherChat.strategyId).name : '';
  const followRef = useRef<() => void>(() => {});
  const [secs, setSecs] = useState(0);

  // Follow the conversation: when something new arrives or a card grows, glide to the bottom,
  // unless you've scrolled up to read (then leave the scroll alone).
  useEffect(() => {
    const el = thread.current;
    if (!el) return;
    let pinned = true;
    const nearBottom = () => el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    // only YOU can unpin it (wheel, touch, keys); our own glide never does
    const onUser = () => setTimeout(() => { pinned = nearBottom(); }, 0);
    const onScroll = () => { if (nearBottom()) pinned = true; };
    let settle: ReturnType<typeof setTimeout> | undefined;
    const follow = () => {
      if (!pinned) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      // if the glide was cut short (or the tab is in the background), land exactly at the bottom
      clearTimeout(settle);
      settle = setTimeout(() => pinned && (el.scrollTop = el.scrollHeight), 450);
    };
    followRef.current = follow;
    const ro = new ResizeObserver(follow);
    ro.observe(el.firstElementChild!);
    el.addEventListener('scroll', onScroll);
    el.addEventListener('wheel', onUser, { passive: true });
    el.addEventListener('touchmove', onUser, { passive: true });
    el.addEventListener('keydown', onUser);
    follow();
    return () => {
      clearTimeout(settle);
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onUser);
      el.removeEventListener('touchmove', onUser);
      el.removeEventListener('keydown', onUser);
    };
  }, [view, hasThread]);
  // and on every new message or card change (cards grow in place)
  useEffect(() => followRef.current(), [messages, typing]);

  // fake voice input: counts up, then types the idea
  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    const done = setTimeout(() => {
      setDraft('Buy when EMA 9 crosses above EMA 21 and RSI is above 50');
      set({ listening: false });
    }, 4000);
    return () => { clearInterval(t); clearTimeout(done); };
  }, [listening, set]);

  const submit = () => {
    if (!canSend) return;
    send(draft);
    setDraft('');
  };

  const placeholder = view === 'pine' ? 'Ask about the code, or describe a change…' : building ? 'Copilot is building… you can still type' : 'Describe your strategy or a condition…';

  return (
    <aside aria-label="Signals Copilot" className="relative flex w-copilot shrink-0 flex-col" style={view === 'pine' ? { width: codeWidth } : undefined}>
      {view === 'pine' && (
        // drag the edge: 440–640px while in code (back to 440 for Chat), remembered for you
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the Pine Script view"
          aria-valuemin={440}
          aria-valuemax={640}
          aria-valuenow={codeWidth}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setWidth(codeWidth + 20);
            if (e.key === 'ArrowRight') setWidth(codeWidth - 20);
          }}
          className="absolute top-0 bottom-0 -left-1 z-20 w-2 cursor-col-resize outline-none hover:bg-brand-tint focus-visible:bg-brand-tint"
        />
      )}
      <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-border-divider pr-3 pl-4">
        <Spark size={16} />
        <h2 className="m-0 text-body-lg font-semibold">Signals Copilot</h2>
        <button
          type="button"
          aria-pressed={view === 'pine'}
          onClick={() => setView(view === 'pine' ? 'chat' : 'pine')}
          // Plex 12.5 label; only the </> glyph is mono (FIXES.md 6)
          className={`relative inline-flex h-7 items-center gap-1.5 rounded-segment-item border px-2.5 font-sans text-chip font-normal outline-none focus-visible:shadow-focus-ring ${view === 'pine' ? 'border-brand bg-brand-tint text-brand' : 'border-border-control bg-surface text-text-secondary hover:bg-surface-hover'}`}
        >
          <CodeGlyph /> Pine Script
          {/* code that hasn't run waits as a draft */}
          {codeDraft && view !== 'pine' && <span aria-label="Code not run yet" title="Code not run yet" className="absolute -top-1 -right-1 size-2 rounded-full bg-brand ring-2 ring-surface" />}
        </button>
        <div className="grow" />
        <IconButton aria-label="New chat" onClick={() => { newChat(); setDraft(''); }}>
          <PlusIcon />
        </IconButton>
        <ChatHistory />
      </div>

      {view === 'pine' ? (
        <PineView />
      ) : messages.length ? (
        // the thread scrolls; each message keeps its full height (never squeezed or clipped)
        <div ref={thread} className="min-h-0 grow overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
            {messages.map((m, i) => (
              <div key={m.id} className="flex shrink-0 animate-msg-in flex-col gap-3">
                {m.kind === 'user' ? (
                  <UserBubble>{m.text}</UserBubble>
                ) : m.kind === 'live' ? (
                  // the strategy moved on since this chat
                  <div className="flex gap-2 rounded-[10px] bg-surface-hover px-3 py-2.5 text-chip leading-[18px] text-text-primary">
                    <span className="pt-0.5"><Spark size={12} /></span>
                    <span>{m.text}</span>
                  </div>
                ) : (
                  <CopilotCard card={m.card} last={i === messages.length - 1 && !otherChat} record={m.record ?? (otherChat ? 'Answered' : undefined)} />
                )}
              </div>
            ))}
            {typing && <Thinking />}
          </div>
        </div>
      ) : ready ? (
        <BacktestReady name={ready.name} onAsk={setDraft} />
      ) : saved ? (
        // a saved strategy with no chats yet, or New chat (+): it knows the strategy
        <div className="flex min-h-0 grow flex-col justify-center gap-5 overflow-auto px-[22px]">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="m-0 text-[20px] leading-[26px] font-semibold">What should we change in {saved.name}?</p>
            <p className="m-0 text-body text-text-tertiary">I can see its blocks, code and last backtest.</p>
          </div>
          <ul className="m-0 list-none overflow-hidden rounded-card border border-border-divider p-0">
            {SAVED_STARTERS.map((s) => (
              <li key={s.title}>
                <button type="button" onClick={() => send(s.title)} className="flex w-full flex-col gap-0.5 bg-surface px-4 py-3 text-left hover:bg-surface-canvas">
                  <span className="text-body font-medium">{s.title}</span>
                  <span className="text-label text-text-muted">{s.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-0 grow flex-col justify-center gap-5 overflow-auto px-[22px]">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="m-0 text-display font-semibold">What should we build, {mockUser.firstName}?</p>
            <p className="m-0 text-body text-text-tertiary">Describe entry and exit in plain words. I'll build it on the canvas.</p>
          </div>
          <ul className="m-0 list-none overflow-hidden rounded-card border border-border-divider p-0">
            {copilotStarters.map((s) => (
              <li key={s.id} className="border-b border-border-subtle last:border-b-0">
                <button type="button" onClick={() => send(s.description)} className="flex w-full flex-col gap-0.5 bg-surface px-3.5 py-3 text-left hover:bg-surface-canvas">
                  <span className="text-body font-medium">{s.title}</span>
                  <span className="text-label text-text-muted">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view !== 'pine' && otherChat && (
        // another strategy's chat is read-only: it can't change the wrong strategy
        <div className="flex shrink-0 items-center gap-3 border-t border-border-divider px-4 py-3">
          <span className="grow text-label text-text-secondary">This chat is about <b className="font-semibold text-text-primary">{otherName}</b>. Open it to keep going.</span>
          <CardAction onClick={() => otherChat.strategyId && useLibrary.getState().openStrategy(otherChat.strategyId)}>Open {otherName}</CardAction>
        </div>
      )}
      {view !== 'pine' && !otherChat && (
      <div className="shrink-0 px-4 pt-3 pb-2.5">
        <div className="flex flex-col gap-2 rounded-card border border-border-control bg-surface px-3 py-2.5 hover:border-border-strong focus-within:shadow-focus-ring">
          {listening ? (
            <span className="flex h-10 items-center gap-1.5 text-body text-sell-text">● Listening… 0:{String(secs).padStart(2, '0')}</span>
          ) : (
            <textarea
              aria-label="Message Copilot"
              placeholder={placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="h-10 resize-none border-0 bg-transparent p-0 font-sans text-body outline-none placeholder:text-text-subtle"
            />
          )}
          <div className="flex items-center gap-2">
            <Button variant="dropdown" className="!h-control-xs">
              Fast
            </Button>
            <div className="grow" />
            <IconButton aria-label="Voice input" aria-pressed={listening} onClick={() => { setSecs(0); set({ listening: !listening }); }} className={listening ? '!bg-sell-tint !text-sell-text' : undefined}>
              <MicIcon />
            </IconButton>
            {building && !canSend ? (
              <Secondary onClick={stop}>Stop</Secondary>
            ) : (
              <button
                type="button"
                aria-label="Send"
                disabled={!canSend}
                onClick={submit}
                className={`flex size-control-sm items-center justify-center rounded-pill transition-colors ${canSend ? 'bg-brand text-text-on-brand' : 'bg-surface-disabled text-text-subtle'}`}
              >
                <ArrowIcon />
              </button>
            )}
          </div>
        </div>
        <p className="m-0 mt-2 text-center text-caption text-text-subtle">AI-generated strategies can contain bugs. Check them on the chart.</p>
      </div>
      )}
    </aside>
  );
}

/** After a backtest: a mini summary, one plain-language insight, three follow-ups (design/backtest-results). */
function BacktestReady({ name, onAsk }: { name: string; onAsk: (q: string) => void }) {
  const variant = variantFor(name);
  const view = resultsView({ variant });
  const s = view.stats;
  const take = copilotTake(view, variant);
  return (
    <div className="flex min-h-0 grow flex-col gap-3 overflow-auto px-4 pt-4">
      <section className="flex flex-col gap-2.5 rounded-card border border-border-divider p-3.5">
        <h3 className="m-0 text-body font-semibold">Backtest ready · {name}</h3>
        <span className="flex flex-wrap gap-x-3.5 gap-y-1 rounded-control bg-surface-hover px-2.5 py-1.5 text-label tabular-nums">
          <span>Net <b className={`font-semibold ${s.profit < 0 ? 'text-pnl-down' : 'text-pnl-up'}`}>{kiloRupees(s.profit)}</b></span>
          <span>Win {Math.round(s.win)}%</span>
          <span>Max DD <b className="font-semibold text-pnl-down">{kiloRupees(s.mdd)}</b></span>
        </span>
        <p className="m-0 text-body text-text-secondary">{take.insight}</p>
      </section>
      <div className="flex flex-wrap gap-2">
        {take.chips.map((c) => (
          <button key={c} type="button" onClick={() => onAsk(c)} className="h-7 rounded-pill border border-border-control bg-surface px-3 text-label hover:border-border-strong hover:bg-surface-hover">
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
