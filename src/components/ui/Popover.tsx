import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/*
  Popover: a floating panel anchored under its trigger.
  Closes when you click outside it or press Escape.
  Used for menus (instrument, timeframe) and the chart data dialog.

  `floating` lifts the panel out of its scroll area (canvas menus), so the
  chart panel can't cut it off; it opens upward when there's no room below.
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
  floating?: boolean;
}

export function Popover({ open, onClose, trigger, children, offsetX = 0, align = 'left', floating = false }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panel.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Floating: follow the trigger on screen, flip up when the bottom is too close
  useLayoutEffect(() => {
    if (!open || !floating) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 0;
      if (!r) return;
      const below = r.bottom + 8;
      const up = below + h > window.innerHeight - 8 && r.top - 8 - h > 8;
      const x = align === 'right' ? { right: window.innerWidth - r.right } : { left: Math.max(8, r.left + offsetX) };
      setPos({ position: 'fixed', top: up ? r.top - 8 - h : below, ...x });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, floating, align, offsetX]);

  return (
    <div ref={ref} className="relative flex">
      {trigger}
      {open &&
        (floating ? (
          createPortal(
            <div ref={panel} data-menu className="z-40" style={pos ?? { position: 'fixed', top: -9999, left: -9999 }}>
              {children}
            </div>,
            document.body,
          )
        ) : (
          <div className="absolute top-10 z-30" style={align === 'right' ? { right: 0 } : { left: offsetX }}>
            {children}
          </div>
        ))}
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
