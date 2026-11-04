import { useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import { HistoryIcon } from '@/components/ui/icons';
import { useCopilot, type Chat } from '@/store/copilot';
import { strategyLabel } from './strategyLabel';

/*
  Chat history (design/copilot/CONVERSATIONS.md · Components). The clock icon lists chats:
  this strategy first, then other strategies (with their name), then No strategy.
  There is no strategy version history.
*/

/** "Now", "2 days ago", "30 Oct". */
function when(t: number) {
  const ms = Date.now() - t;
  if (ms < 60 * 60_000) return 'Now';
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  if (days < 3) return days === 1 ? 'Yesterday' : `${days} days ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

const GROUP = 'px-3 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-text-subtle';

function ChatRow({ chat, current, other, onPick }: { chat: Chat; current: boolean; other: boolean; onPick: () => void }) {
  const { renameChat, deleteChat } = useCopilot.getState();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const label = strategyLabel(chat.strategyId);
  if (renaming)
    return (
      <div className="px-1.5 py-1">
        <input
          autoFocus
          aria-label="Chat name"
          defaultValue={chat.title}
          onBlur={(e) => { renameChat(chat.id, e.target.value); setRenaming(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { renameChat(chat.id, e.currentTarget.value); setRenaming(false); }
            if (e.key === 'Escape') setRenaming(false);
          }}
          className="h-8 w-full rounded-chip border border-brand px-2 text-body outline-none shadow-focus-ring"
        />
      </div>
    );
  return (
    <div className={`group/row relative mx-1.5 flex min-h-9 items-center gap-3 rounded-chip px-2 py-1.5 ${current ? 'bg-menu-current' : 'hover:bg-surface-selected'}`}>
      <button
        type="button"
        onClick={onPick}
        onKeyDown={(e) => e.key === 'F2' && setRenaming(true)}
        className="flex min-w-0 grow flex-col text-left outline-none focus-visible:shadow-focus-inset"
      >
        <span className={`truncate text-body font-medium ${current ? 'text-brand-text' : 'text-text-primary'}`}>{chat.title}</span>
        {other && <span className="truncate text-[11px] text-text-tertiary">{label.name}{label.index ? ` · ${label.index}` : ''}</span>}
      </button>
      {/* hover swaps the time for ⋯ */}
      <span className={`shrink-0 text-[11px] text-text-tertiary ${menu ? 'hidden' : 'group-hover/row:hidden'}`}>{when(chat.updatedAt)}</span>
      <Popover
        floating
        align="right"
        open={menu}
        onClose={() => setMenu(false)}
        trigger={
          <button type="button" aria-label="Chat actions" onClick={() => setMenu((m) => !m)} className={`size-6 shrink-0 items-center justify-center rounded-[5px] text-text-secondary hover:bg-row-pressed ${menu ? 'flex bg-row-pressed' : 'hidden group-hover/row:flex'}`}>
            ⋯
          </button>
        }
      >
        <div role="menu" className="flex w-[200px] flex-col rounded-block border border-border-control bg-surface p-1 shadow-surface">
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setRenaming(true); }} className="flex h-8 items-center justify-between rounded-chip px-2.5 text-body hover:bg-surface-selected">
            Rename <span className="text-hint text-text-subtle">F2</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); deleteChat(chat.id); }} className="flex h-8 items-center justify-between rounded-chip px-2.5 text-body text-error hover:bg-error-bg">
            Delete chat <span className="text-hint text-text-subtle">⌫</span>
          </button>
        </div>
      </Popover>
    </div>
  );
}

export function ChatHistory() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const { chats, activeChatId, strategyId, openChat } = useCopilot();
  const match = (c: Chat) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase());
  const byTime = (a: Chat, b: Chat) => b.updatedAt - a.updatedAt;
  const mine = chats.filter((c) => strategyId !== null && c.strategyId === strategyId && match(c)).sort(byTime);
  const others = chats.filter((c) => c.strategyId !== null && c.strategyId !== strategyId && match(c)).sort(byTime);
  const none = chats.filter((c) => c.strategyId === null && match(c)).sort(byTime);
  const pick = (id: string) => {
    setOpen(false);
    openChat(id);
  };
  const thisName = strategyLabel(strategyId).name;

  return (
    <Popover
      floating
      align="right"
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          aria-label="Chat history"
          title="Chat history"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`flex size-8 items-center justify-center rounded-control outline-none focus-visible:shadow-focus-ring ${open ? 'bg-brand-tint text-brand' : 'text-text-secondary hover:bg-surface-selected'}`}
        >
          <HistoryIcon />
        </button>
      }
    >
      <div role="dialog" aria-label="Chat history" className="flex max-h-[480px] w-[340px] flex-col overflow-hidden rounded-card border border-border-control bg-surface shadow-surface">
        <div className="shrink-0 p-2.5 pb-1">
          <label className="flex h-[34px] items-center gap-2 rounded-control border border-border-control px-2.5 text-text-tertiary focus-within:shadow-focus-ring">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="min-w-0 grow border-0 bg-transparent text-body text-text-primary outline-none placeholder:text-text-tertiary" />
          </label>
        </div>
        <div className="min-h-0 overflow-y-auto pb-1.5">
          {strategyId !== null && (
            <>
              <div className={GROUP}>THIS STRATEGY · {thisName.toUpperCase()}</div>
              {mine.length ? mine.map((c) => <ChatRow key={c.id} chat={c} current={c.id === activeChatId} other={false} onPick={() => pick(c.id)} />) : <p className="m-0 px-3 py-1.5 text-body text-text-secondary">No chats yet for this strategy.</p>}
            </>
          )}
          {others.length > 0 && (
            <>
              <div className={`${GROUP} mt-1 border-t border-border-subtle`}>OTHER STRATEGIES</div>
              {others.map((c) => <ChatRow key={c.id} chat={c} current={c.id === activeChatId} other onPick={() => pick(c.id)} />)}
            </>
          )}
          {none.length > 0 && (
            <>
              <div className={`${GROUP} mt-1 border-t border-border-subtle`}>NO STRATEGY</div>
              {none.map((c) => <ChatRow key={c.id} chat={c} current={c.id === activeChatId} other={false} onPick={() => pick(c.id)} />)}
            </>
          )}
        </div>
      </div>
    </Popover>
  );
}
