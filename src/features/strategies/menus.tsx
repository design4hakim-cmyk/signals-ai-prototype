import type { ReactNode } from 'react';

/*
  The row's ⋯ menu (220w) and the delete confirm (250w, anchored to ⋯).
  While anything runs, Delete is disabled with the reason.
*/

function Row({ children, hint, shortcut, danger, disabled, hover, onClick }: { children: ReactNode; hint?: string; shortcut?: string; danger?: boolean; disabled?: boolean; hover?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex min-h-8 w-full items-center justify-between gap-3 rounded-chip px-2.5 py-1.5 text-left text-body outline-none focus-visible:shadow-focus-inset disabled:cursor-not-allowed ${
        disabled ? 'text-text-disabled' : danger ? 'text-error hover:bg-error-bg active:bg-error-pressed' : 'text-text-primary hover:bg-surface-selected active:bg-row-pressed'
      } ${hover ? (danger ? 'bg-error-bg' : 'bg-surface-selected') : ''}`}
    >
      <span className="flex flex-col">
        {children}
        {hint && <span className="text-hint text-text-tertiary">{hint}</span>}
      </span>
      {shortcut && <span className="text-hint text-text-subtle">{shortcut}</span>}
    </button>
  );
}

const Divider = () => <div className="mx-1 my-1 h-px bg-border-subtle" />;

export function RowMenu({
  running = 0,
  hoverRow,
  onOpen,
  onTrade,
  onRename,
  onDuplicate,
  onDelete,
}: {
  /** live + forward tests running; > 0 blocks Delete */
  running?: number;
  /** Storybook: show a row hovered */
  hoverRow?: 'rename';
  onOpen?: () => void;
  onTrade?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    // clicks inside the floating menu must not reach the row underneath (which would open the strategy)
    <div role="menu" aria-label="Strategy actions" onClick={(e) => e.stopPropagation()} className="flex w-[220px] flex-col rounded-control border border-border-control bg-surface p-1 shadow-surface">
      <Row shortcut="↵" onClick={onOpen}>Open in builder</Row>
      <Row onClick={onTrade}>Trade…</Row>
      <Divider />
      <Row shortcut="F2" hover={hoverRow === 'rename'} onClick={onRename}>Rename</Row>
      <Row shortcut="⌘D" onClick={onDuplicate}>Duplicate</Row>
      <Divider />
      {running > 0 ? (
        <Row disabled hint={`Stop its ${running} running trade${running > 1 ? 's' : ''} first`}>Delete</Row>
      ) : (
        <Row danger shortcut="⌫" onClick={onDelete}>Delete</Row>
      )}
    </div>
  );
}

export function DeleteConfirm({ name, onCancel, onDelete }: { name: string; onCancel?: () => void; onDelete?: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-label={`Delete “${name}”?`}
      onClick={(e) => e.stopPropagation()}
      className="flex w-[250px] flex-col gap-2 rounded-control border border-border-control bg-surface p-4 shadow-surface"
    >
      <span className="text-body font-semibold">Delete “{name}”?</span>
      <span className="text-label text-text-secondary">Its saved setups and backtest results go too. This can’t be undone.</span>
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" autoFocus onClick={onCancel} className="h-[30px] rounded-control border border-border-chip bg-surface px-3 text-body hover:bg-surface-hover active:bg-row-pressed focus-visible:shadow-focus-ring">
          Cancel
        </button>
        <button type="button" onClick={onDelete} className="h-[30px] rounded-control border border-border-chip bg-surface px-3 text-body text-error hover:bg-error-bg active:bg-error-pressed focus-visible:shadow-focus-ring">
          Delete
        </button>
      </div>
    </div>
  );
}
