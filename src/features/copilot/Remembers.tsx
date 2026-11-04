import { useState } from 'react';
import { useCopilot } from '@/store/copilot';
import { Spark } from './parts';

/*
  What Copilot remembers (design/copilot/CONVERSATIONS.md · Components): short strategy notes
  Copilot writes from your chats. Every chat on the strategy reads them. Edit, remove or clear.
  Opened from strategy ⋯ (My Strategies row, top nav).
*/

export function RemembersPanel({ strategyId, name }: { strategyId: string; name: string }) {
  const notes = useCopilot((s) => s.notes[strategyId] ?? []);
  const { addNote, removeNote, clearNotes } = useCopilot.getState();
  const [adding, setAdding] = useState(false);
  return (
    <div role="dialog" aria-label="What Copilot remembers" onClick={(e) => e.stopPropagation()} className="flex w-[340px] flex-col rounded-card border border-border-control bg-surface shadow-surface">
      <div className="flex flex-col gap-0.5 px-4 pt-3.5 pb-2">
        <span className="flex items-center gap-1.5 text-body font-semibold">What Copilot remembers</span>
        <span className="text-label text-text-tertiary">About {name}. Written from your chats; edit or remove anything.</span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0 px-2">
        {notes.map((n, i) => (
          <li key={`${i}-${n}`} className="group/note flex items-start gap-2 rounded-chip px-2 py-1.5 hover:bg-surface-hover">
            <span aria-hidden="true" className="pt-0.5 text-text-subtle">•</span>
            <span className="grow text-label leading-[18px] text-text-primary">{n}</span>
            <button type="button" aria-label={`Remove “${n}”`} onClick={() => removeNote(strategyId, i)} className="shrink-0 rounded-[4px] px-1 text-text-tertiary hover:bg-surface-selected hover:text-text-primary">✕</button>
          </li>
        ))}
        {!notes.length && !adding && <li className="px-2 py-1.5 text-label text-text-tertiary">Nothing yet. Copilot writes notes when a chat goes quiet.</li>}
        {adding && (
          <li className="px-2 py-1.5">
            <input
              autoFocus
              aria-label="New note"
              placeholder="e.g. Trades NIFTY on 15m only."
              onKeyDown={(e) => {
                if (e.key === 'Enter') { addNote(strategyId, e.currentTarget.value); setAdding(false); }
                if (e.key === 'Escape') setAdding(false);
              }}
              onBlur={(e) => { addNote(strategyId, e.target.value); setAdding(false); }}
              className="h-8 w-full rounded-chip border border-brand px-2 text-label outline-none shadow-focus-ring"
            />
          </li>
        )}
      </ul>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border-subtle px-3 py-2.5">
        <button type="button" onClick={() => setAdding(true)} className="h-[30px] rounded-chip border border-border-chip bg-surface px-3 text-body font-medium hover:bg-surface-hover">Add a note</button>
        <button type="button" disabled={!notes.length} onClick={() => clearNotes(strategyId)} className="h-[30px] rounded-chip border border-border-chip bg-surface px-3 text-body font-medium text-error hover:bg-error-bg disabled:text-text-disabled disabled:hover:bg-surface">Clear all</button>
      </div>
    </div>
  );
}

/** The menu item: ✦ on the right (it's Copilot's). */
export const RemembersItemMark = () => <Spark size={12} />;
