import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronIcon, IndexIcon, RunningChips, type Force } from './parts';

/*
  Molecules (design/strategies-panel/COMPONENTS.md · Molecules).
  Rows are rounded and sit inside the panel, so hover / pressed / focus fills
  follow the corners. Keyboard focus is an inset ring that follows the radius.
*/

/** Search match in bold, never a blue fill. */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (!q || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<b className="font-bold">{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>;
}

/* ── Strategy row ──────────────────────────────────────────────── */

export interface StrategyRowProps {
  id: string;
  name: string;
  live: number;
  forwardTests: number;
  /** open in the builder: blue tint, blue name */
  open?: boolean;
  /** open in the builder with unsaved canvas changes: blue dot after the name */
  unsaved?: boolean;
  /** inside an expanded index card (left padding 44 instead of 48) */
  inCard?: boolean;
  query?: string;
  force?: Force;
  /** the ⋯ menu is open: hover look, ⋯ in its open state */
  menuOpen?: boolean;
  /** the name field, while renaming */
  renameSlot?: ReactNode;
  /** Trade + ⋯ (with their popovers) */
  actions?: ReactNode;
  onOpen?: () => void;
  onRename?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export function StrategyRow({ id, name, live, forwardTests, open = false, unsaved = false, inCard = false, query, force, menuOpen = false, renameSlot, actions, onOpen, onRename, onKeyDown }: StrategyRowProps) {
  const renaming = !!renameSlot;
  const fill = renaming
    ? 'bg-surface-selected'
    : open
      ? 'bg-menu-current'
      : force === 'pressed'
        ? 'bg-row-pressed'
        : force === 'hover' || menuOpen
          ? 'bg-surface-selected'
          : 'hover:bg-surface-selected active:bg-row-pressed';
  // Trade + ⋯ show on hover, keyboard focus, or while the menu is open
  const showActions = force === 'hover' || force === 'pressed' || force === 'focused' || menuOpen;

  return (
    <div
      role="treeitem"
      aria-selected={open}
      tabIndex={0}
      data-nav="strategy"
      data-id={id}
      onClick={() => !renaming && onOpen?.()}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-name]')) onRename?.();
      }}
      onKeyDown={onKeyDown}
      className={`group/row flex min-h-10 cursor-pointer flex-col gap-1 rounded-chip py-[7px] pr-2 outline-none focus-visible:shadow-focus-inset ${inCard ? 'pl-11' : 'pl-12'} ${fill} ${
        force === 'focused' ? 'shadow-focus-inset' : ''
      }`}
    >
      {renaming ? (
        renameSlot
      ) : (
        <>
          <div className="flex min-h-[26px] items-center gap-2">
            <span data-name title={name} className={`line-clamp-2 grow text-body font-medium break-words ${open ? 'text-brand-text' : 'text-text-primary'}`}>
              <Highlight text={name} query={query} />
              {unsaved && <span aria-label="Unsaved changes" className="ml-1.5 inline-block size-1.5 rounded-full bg-brand align-middle" />}
            </span>
            {actions && (
              <span className={`items-center gap-0.5 ${showActions ? 'flex' : 'hidden group-hover/row:flex group-focus-visible/row:flex group-focus-within/row:flex'}`}>
                {actions}
              </span>
            )}
          </div>
          <RunningChips live={live} forwardTests={forwardTests} />
        </>
      )}
    </div>
  );
}

/* ── Index row (collapsed, or the header of an expanded card) ──── */

export function IndexRow({
  symbol,
  logoUrl,
  count,
  expanded = false,
  force,
  onToggle,
  onKeyDown,
}: {
  symbol: string;
  logoUrl?: string;
  count: number;
  expanded?: boolean;
  force?: Force;
  onToggle?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const fill =
    force === 'pressed' ? 'bg-row-pressed' : force === 'hover' ? 'bg-surface-selected' : expanded ? 'hover:bg-row-pressed/60' : 'hover:bg-surface-selected active:bg-row-pressed';
  return (
    <button
      type="button"
      aria-expanded={expanded}
      data-nav="index"
      data-symbol={symbol}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      className={`flex w-full items-center gap-2.5 rounded-control px-2 py-2.5 text-left outline-none focus-visible:shadow-focus-inset ${fill} ${force === 'focused' ? 'shadow-focus-inset' : ''}`}
    >
      <IndexIcon symbol={symbol} logoUrl={logoUrl} />
      <span className="flex grow flex-col">
        <span className={`text-body-lg ${expanded ? 'font-semibold' : 'font-medium'}`}>{symbol}</span>
        <span className="text-label text-text-muted">{count} {count === 1 ? 'Strategy' : 'Strategies'}</span>
      </span>
      <ChevronIcon up={expanded} />
    </button>
  );
}

/** An expanded index: a soft tinted card holding its strategies. No lines between them — they're independent. */
export function IndexCard({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div role="group" className="flex flex-col rounded-control bg-index-card">
      {header}
      <div role="group" className="flex flex-col gap-0.5 px-1 pb-1">{children}</div>
    </div>
  );
}
