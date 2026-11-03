import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { ArrowIcon, HistoryIcon, MicIcon, PlusIcon } from '@/components/ui/icons';
import { copilotTake, kiloRupees, resultsView, variantFor } from '@/lib/backtestData';
import { copilotStarters, mockUser } from '@/mock/copilot';
import { useBacktest } from '@/store/backtest';
import { useCopilot } from '@/store/copilot';
import { useStrategy } from '@/store/strategy';
import { CopilotCard, Thinking } from './Cards';
import { Secondary, Spark, UserBubble } from './parts';
import { PineView } from './PineView';

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
    <aside aria-label="Signals Copilot" className="flex w-copilot shrink-0 flex-col">
      <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-border-divider px-4">
        <Spark size={16} />
        <h2 className="m-0 text-body-lg font-semibold">Signals Copilot</h2>
        <button
          type="button"
          aria-pressed={view === 'pine'}
          onClick={() => setView(view === 'pine' ? 'chat' : 'pine')}
          className={`h-7 rounded-control border px-2.5 font-mono text-label outline-none focus-visible:shadow-focus-ring ${view === 'pine' ? 'border-brand bg-brand-tint text-brand' : 'border-border-control bg-surface text-text-secondary hover:bg-surface-hover'}`}
        >
          &lt;/&gt; Pine Script
        </button>
        <div className="grow" />
        <IconButton aria-label="New chat" onClick={() => { newChat(); setDraft(''); }}>
          <PlusIcon />
        </IconButton>
        <IconButton aria-label="History">
          <HistoryIcon />
        </IconButton>
      </div>

      {view === 'pine' ? (
        <PineView />
      ) : messages.length ? (
        // the thread scrolls; each message keeps its full height (never squeezed or clipped)
        <div ref={thread} className="min-h-0 grow overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
            {messages.map((m, i) => (
              <div key={m.id} className="flex shrink-0 animate-msg-in flex-col gap-3">
                {m.kind === 'user' ? <UserBubble>{m.text}</UserBubble> : <CopilotCard card={m.card} last={i === messages.length - 1} />}
              </div>
            ))}
            {typing && <Thinking />}
          </div>
        </div>
      ) : ready ? (
        <BacktestReady name={ready.name} onAsk={setDraft} />
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
