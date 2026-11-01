import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useCanvas } from '@/store/canvas';

/*
  "Smart animate" for the condition tree, like a Figma prototype.
  Any element marked `data-flip="<id>"` glides from where it was to where it
  is now whenever the tree changes (reorder, group, delete, drop, undo).
  New elements fade in. The technique is called FLIP:
    First (measure before) → Last (measure after) → Invert → Play.
*/

const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

export function useSmartAnimate(root: RefObject<HTMLElement | null>) {
  const before = useRef(new Map<string, DOMRect>());

  // The store updates before React redraws, so the screen still shows the OLD tree here
  useEffect(
    () =>
      useCanvas.subscribe((s, p) => {
        if (s.entry === p.entry && s.exit === p.exit) return;
        const m = new Map<string, DOMRect>();
        root.current?.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => m.set(el.dataset.flip!, el.getBoundingClientRect()));
        before.current = m;
      }),
    [root],
  );

  const entry = useCanvas((s) => s.entry);
  const exit = useCanvas((s) => s.exit);

  useLayoutEffect(() => {
    const prev = before.current;
    if (!prev.size || !root.current) return;
    before.current = new Map();
    const zoom = useCanvas.getState().view.zoom;
    const els = [...root.current.querySelectorAll<HTMLElement>('[data-flip]')];
    const now = new Map(els.map((el) => [el.dataset.flip!, el.getBoundingClientRect()]));

    for (const el of els) {
      const id = el.dataset.flip!;
      const was = prev.get(id);
      const is = now.get(id)!;
      if (!was) {
        el.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
        continue;
      }
      // Measure against the nearest animated parent, so a row inside a moving box doesn't move twice
      const parentEl = el.parentElement?.closest<HTMLElement>('[data-flip]');
      const pid = parentEl?.dataset.flip;
      // a parent that's new (e.g. a box just created) didn't move, so measure against the screen
      const both = pid && prev.has(pid) && now.has(pid);
      const pw = both ? prev.get(pid) : undefined;
      const pn = both ? now.get(pid) : undefined;
      const dx = (was.left - (pw?.left ?? 0) - (is.left - (pn?.left ?? 0))) / zoom;
      const dy = (was.top - (pw?.top ?? 0) - (is.top - (pn?.top ?? 0))) / zoom;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 280, easing: EASE });
    }
  }, [entry, exit, root]);
}
