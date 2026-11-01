import { useEffect, useRef, type ReactNode } from 'react';

/*
  Popover: a floating panel anchored under its trigger.
  Closes when you click outside it or press Escape.
  Used for menus (instrument, timeframe) and the chart data dialog.
*/

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  /** px offset from the trigger's left edge (K08 shifts the wide dialog left) */
  offsetX?: number;
  /** 'right' anchors the panel's right edge to the trigger's (menus near the screen edge) */
  align?: 'left' | 'right';
}

export function Popover({ open, onClose, trigger, children, offsetX = 0, align = 'left' }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative flex">
      {trigger}
      {open && (
        <div className="absolute top-10 z-30" style={align === 'right' ? { right: 0 } : { left: offsetX }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** The white floating surface used by small menus (K03, K04). */
export function MenuSurface({ width, children, label }: { width: number; children: ReactNode; label: string }) {
  return (
    <div
      role="listbox"
      aria-label={label}
      style={{ width }}
      className="flex flex-col gap-0.5 rounded-card border border-border-control bg-surface p-1.5 shadow-menu"
    >
      {children}
    </div>
  );
}
