import { useEffect, type ReactNode } from 'react';

/*
  Small centred confirmation dialog. Esc or clicking the backdrop closes it.
  One filled-blue button (primary), one outlined (secondary).
*/

interface Action {
  label: string;
  onClick: () => void;
}

export function Modal({
  title,
  children,
  onClose,
  primary,
  secondary,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  primary: Action;
  secondary?: Action;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,22,28,0.28)]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-[420px] flex-col gap-3 rounded-dialog border border-border-control bg-surface p-5 shadow-dialog"
      >
        <h2 className="m-0 text-[16px] font-semibold">{title}</h2>
        <p className="m-0 text-body text-text-secondary">{children}</p>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="mr-auto text-body text-text-tertiary hover:text-text-primary">
            Cancel
          </button>
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="h-[34px] rounded-control border border-brand bg-surface px-3.5 text-body font-medium text-brand hover:bg-brand-tint"
            >
              {secondary.label}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={primary.onClick}
            className="h-[34px] rounded-control bg-brand px-4 text-body font-medium text-text-on-brand hover:bg-brand-hover"
          >
            {primary.label}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bottom-centre toast for quiet confirmations. */
export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-control bg-text-primary px-4 py-2.5 text-body text-text-on-brand shadow-dialog">
      {text}
    </div>
  );
}
