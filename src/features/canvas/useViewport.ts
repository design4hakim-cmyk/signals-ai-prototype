import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useCanvas } from '@/store/canvas';

/*
  The canvas camera, Figma-style:
    • two-finger scroll / mouse wheel  → pan
    • ⌘ + scroll, or trackpad pinch    → zoom around the pointer
    • Space + drag, or middle-drag      → pan (hand tool)
    • ⌘+ / ⌘−   zoom in / out · ⇧1 zoom to fit · ⇧0 or ⌘0 back to 100%
  Zooming with buttons or keys glides; wheel and drag follow the hand directly.
*/

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];

const typing = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.('input,textarea,select,[contenteditable="true"]');

export function useViewport(viewport: RefObject<HTMLDivElement | null>, world: RefObject<HTMLDivElement | null>) {
  const [gliding, setGliding] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const glideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const glide = () => {
    setGliding(true);
    clearTimeout(glideTimer.current);
    glideTimer.current = setTimeout(() => setGliding(false), 260);
  };

  /** Zoom to `next`, keeping the point under (ax, ay) — in viewport px — still. */
  const zoomTo = useCallback(
    (next: number, anchor?: { x: number; y: number }, animate = false) => {
      const { view, setView } = useCanvas.getState();
      const el = viewport.current;
      if (!el) return;
      const z = clamp(next);
      const a = anchor ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
      if (animate) glide();
      setView({ zoom: z, x: a.x - (a.x - view.x) * (z / view.zoom), y: a.y - (a.y - view.y) * (z / view.zoom) });
    },
    [viewport],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const z = useCanvas.getState().view.zoom;
      const next = dir > 0 ? STEPS.find((s) => s > z + 0.001) ?? MAX_ZOOM : [...STEPS].reverse().find((s) => s < z - 0.001) ?? MIN_ZOOM;
      zoomTo(next, undefined, true);
    },
    [zoomTo],
  );

  /** Everything on the canvas in one look (never bigger than 100%). */
  const fit = useCallback(() => {
    const el = viewport.current;
    const frames = world.current?.querySelectorAll<HTMLElement>('[data-frame]');
    if (!el || !frames?.length) return;
    let [l, t, r, b] = [Infinity, Infinity, -Infinity, -Infinity];
    frames.forEach((f) => {
      l = Math.min(l, f.offsetLeft);
      t = Math.min(t, f.offsetTop);
      r = Math.max(r, f.offsetLeft + f.offsetWidth);
      b = Math.max(b, f.offsetTop + f.offsetHeight);
    });
    const pad = 40;
    const z = clamp(Math.min((el.clientWidth - pad * 2) / (r - l), (el.clientHeight - pad * 2) / (b - t), 1));
    glide();
    useCanvas.getState().setView({ zoom: z, x: (el.clientWidth - (r - l) * z) / 2 - l * z, y: (el.clientHeight - (b - t) * z) / 2 - t * z });
  }, [viewport, world]);

  const reset = useCallback(() => {
    glide();
    useCanvas.getState().setView({ x: 0, y: 0, zoom: 1 });
  }, []);

  // Wheel: needs a non-passive listener so pinch-zoom doesn't zoom the whole page
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view, setView } = useCanvas.getState();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoomTo(view.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setView({ ...view, x: view.x - dx, y: view.y - dy });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewport, zoomTo]);

  // Keyboard: Space = hand tool, zoom shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space' && !mod) {
        e.preventDefault(); // no page scroll, no button press
        setSpaceDown(true);
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        step(1);
      } else if (mod && e.key === '-') {
        e.preventDefault();
        step(-1);
      } else if ((mod && e.key === '0') || (e.shiftKey && e.code === 'Digit0')) {
        e.preventDefault();
        zoomTo(1, undefined, true);
      } else if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        fit();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, [step, zoomTo, fit]);

  /** Start a hand-tool pan from a pointer-down. */
  const startPan = (e: ReactPointerEvent) => {
    e.preventDefault();
    setPanning(true);
    const start = { px: e.clientX, py: e.clientY, view: useCanvas.getState().view };
    const move = (ev: PointerEvent) =>
      useCanvas.getState().setView({ ...start.view, x: start.view.x + ev.clientX - start.px, y: start.view.y + ev.clientY - start.py });
    const end = () => {
      setPanning(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  return { gliding, spaceDown, panning, startPan, step, fit, reset, zoomTo };
}
