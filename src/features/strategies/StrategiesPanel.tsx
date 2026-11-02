import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FolderIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { INDEXES } from '@/mock/savedStrategies';
import { indexOrder, nameError, useLibrary } from '@/store/library';
import { useStrategy } from '@/store/strategy';
import { DeleteConfirm, RowMenu } from './menus';
import { IconButton, NameInput, PanelToast, SearchField, TradeButton } from './parts';
import { IndexCard, IndexRow, StrategyRow } from './rows';

/*
  My Strategies panel (design/strategies-panel). Width 290.
    pinned — beside the builder, 1px border
    peek   — opens on hovering the folder icon, floats with a shadow
  Header · search · list of indexes (expand to see strategies, last edited first) · + New strategy.
  Keyboard in the list: ↑ ↓ move · → ← expand / collapse · Enter open · F2 rename ·
  ⌘D duplicate · ⌫ delete (with the confirm) · / search.
*/

export function StrategiesPanel({ variant }: { variant: 'pinned' | 'peek' }) {
  const strategies = useLibrary((s) => s.strategies);
  const query = useLibrary((s) => s.query);
  const loading = useLibrary((s) => s.loading);
  const toast = useLibrary((s) => s.toast);
  const { setMode, setQuery, newStrategy } = useLibrary.getState();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // "/" focuses search while the panel is open
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || (e.target as HTMLElement).closest?.('input,textarea,select,[contenteditable="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? strategies.filter((s) => s.name.toLowerCase().includes(q)) : strategies;

  // ↑ ↓ move between rows (index rows and strategy rows, in screen order)
  const moveFocus = (from: HTMLElement, dir: 1 | -1) => {
    const all = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-nav]') ?? [])];
    all[all.indexOf(from) + dir]?.focus();
  };

  return (
    <aside
      aria-label="My Strategies"
      className={`flex h-full w-[290px] shrink-0 flex-col bg-surface ${variant === 'pinned' ? 'border-r border-border-divider' : 'shadow-peek'}`}
    >
      <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-border-divider px-4">
        <FolderIcon />
        <h2 className="m-0 grow text-title font-semibold">My Strategies</h2>
        {variant === 'peek' ? (
          <IconButton kind="pin" label="Pin panel" onClick={() => setMode('pinned')} />
        ) : (
          <IconButton kind="unpin" label="Close panel" onClick={() => setMode('closed')} />
        )}
      </div>

      <div className="shrink-0 border-b border-border-divider px-3.5 py-3">
        <SearchField value={query} onChange={setQuery} inputRef={searchRef} />
      </div>

      <div ref={listRef} role="tree" aria-label="Saved strategies" className="flex min-h-0 grow flex-col gap-0.5 overflow-auto p-1.5">
        {loading ? (
          <Skeleton />
        ) : strategies.length === 0 ? (
          <div className="flex flex-col gap-1 px-2.5 py-6">
            <span className="text-body font-semibold">No saved strategies yet</span>
            <span className="text-label text-text-tertiary">Save one from the builder and it appears here, grouped by index.</span>
          </div>
        ) : q && matches.length === 0 ? (
          <div className="flex flex-col gap-1 px-2.5 py-6">
            <span className="text-body">No strategy called “{query.trim()}”</span>
            <span className="text-label text-text-tertiary">Check the spelling, or start a new one below.</span>
          </div>
        ) : (
          indexOrder(matches).map((symbol) => <IndexGroup key={symbol} symbol={symbol} searching={!!q} moveFocus={moveFocus} />)
        )}
      </div>

      {toast && (
        <div className="shrink-0 px-3 pb-2">
          <PanelToast text={toast.text} onUndo={toast.undo} />
        </div>
      )}

      <div className="shrink-0 border-t border-border-divider p-3">
        <button
          type="button"
          onClick={newStrategy}
          className="h-[34px] w-full rounded-control border border-border-chip bg-surface text-body font-medium hover:bg-surface-hover active:bg-row-pressed focus-visible:shadow-focus-ring"
        >
          + New strategy
        </button>
      </div>
    </aside>
  );
}

function Skeleton() {
  return (
    <div aria-label="Loading" className="flex animate-pulse flex-col gap-1 p-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-2.5">
          <span className="size-[30px] rounded-[7px] bg-surface-selected" />
          <span className="flex grow flex-col gap-1.5">
            <span className="h-3 w-24 rounded bg-surface-selected" />
            <span className="h-2.5 w-16 rounded bg-surface-hover" />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── One index: a row, or a tinted card when expanded ──────────── */

function IndexGroup({ symbol, searching, moveFocus }: { symbol: string; searching: boolean; moveFocus: (from: HTMLElement, dir: 1 | -1) => void }) {
  const all = useLibrary((s) => s.strategies);
  const query = useLibrary((s) => s.query).trim().toLowerCase();
  const isExpanded = useLibrary((s) => s.expanded.includes(symbol));
  const { toggleIndex } = useLibrary.getState();
  const list = all
    .filter((s) => s.indexSymbol === symbol && (!query || s.name.toLowerCase().includes(query)))
    .sort((a, b) => b.updatedAt - a.updatedAt); // last edited first
  // while searching, indexes with matches open by themselves
  const expanded = searching || isExpanded;
  const logoUrl = INDEXES.find((i) => i.symbol === symbol)?.logoUrl;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'ArrowRight' && !expanded) {
      e.preventDefault();
      toggleIndex(symbol, true);
    } else if (e.key === 'ArrowLeft' && expanded) {
      e.preventDefault();
      toggleIndex(symbol, false);
    }
  };

  const header = <IndexRow symbol={symbol} logoUrl={logoUrl} count={all.filter((s) => s.indexSymbol === symbol).length} expanded={expanded} onToggle={() => toggleIndex(symbol)} onKeyDown={onKey} />;
  if (!expanded) return header;
  return (
    <IndexCard header={header}>
      {list.map((s) => <ConnectedRow key={s.id} id={s.id} symbol={symbol} moveFocus={moveFocus} />)}
    </IndexCard>
  );
}

/* ── A strategy row wired to the store ─────────────────────────── */

function ConnectedRow({ id, symbol, moveFocus }: { id: string; symbol: string; moveFocus: (from: HTMLElement, dir: 1 | -1) => void }) {
  const s = useLibrary((st) => st.strategies.find((x) => x.id === id))!;
  const openId = useLibrary((st) => st.openId);
  const query = useLibrary((st) => st.query);
  const renaming = useLibrary((st) => st.renamingId === id);
  const menuOpen = useLibrary((st) => st.menuId === id);
  const confirming = useLibrary((st) => st.confirmDeleteId === id);
  const unsaved = useStrategy((st) => st.dirty);
  const { openStrategy, rename, duplicate, remove, set, toggleIndex } = useLibrary.getState();
  const [draft, setDraft] = useState(s.name);
  const [error, setError] = useState<string | null>(null);
  const running = s.live + s.forwardTests;
  const isOpen = openId === id;

  const startRename = () => {
    setDraft(s.name);
    setError(null);
    set({ renamingId: id, menuId: null });
  };
  const trade = () => set({ tradeFor: { id, name: s.name }, menuId: null });
  const askDelete = () => running === 0 && set({ confirmDeleteId: id, menuId: null });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      toggleIndex(symbol, false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openStrategy(id);
    } else if (e.key === 'F2') {
      e.preventDefault();
      startRename();
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicate(id);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (running) set({ menuId: id }); // the menu shows why it can't be deleted
      else askDelete();
    }
  };

  return (
    <StrategyRow
      id={id}
      name={s.name}
      live={s.live}
      forwardTests={s.forwardTests}
      open={isOpen}
      unsaved={isOpen && unsaved}
      inCard
      query={query}
      menuOpen={menuOpen || confirming}
      onOpen={() => openStrategy(id)}
      onRename={startRename}
      onKeyDown={onKeyDown}
      renameSlot={
        renaming ? (
          <NameInput
            value={draft}
            error={error}
            onChange={(v) => {
              setDraft(v);
              if (error) setError(nameError(useLibrary.getState().strategies, id, v));
            }}
            onSubmit={() => setError(rename(id, draft))}
            onCancel={() => set({ renamingId: null })}
          />
        ) : undefined
      }
      actions={
        <>
          <TradeButton onClick={trade} />
          <Popover
            floating
            align="right"
            open={menuOpen || confirming}
            onClose={() => set({ menuId: null, confirmDeleteId: null })}
            trigger={<IconButton kind="more" label="More actions" open={menuOpen || confirming} onClick={() => set({ menuId: menuOpen || confirming ? null : id, confirmDeleteId: null })} />}
          >
            {confirming ? (
              <DeleteConfirm name={s.name} onCancel={() => set({ confirmDeleteId: null })} onDelete={() => remove(id)} />
            ) : (
              <RowMenu running={running} onOpen={() => openStrategy(id)} onTrade={trade} onRename={startRename} onDuplicate={() => duplicate(id)} onDelete={askDelete} />
            )}
          </Popover>
        </>
      }
    />
  );
}
