import type { CSSProperties } from 'react';

/*
  The editor layer (COMPONENTS.md §0). The ONLY place rings are computed.

  Every canvas element has two layers:
    1. its own look (grey / red error / violet Copilot / dashed empty) — never changes on interaction
    2. this editor layer: blue rings OUTSIDE the border, as a box-shadow

  Precedence: disabled → nothing · one inner ring (selected > pressed > hover) ·
  focus always outside it · preview mode hides the whole layer.
  Colours come from tokens.css, so a token change updates every ring.
*/

export type Interaction = 'default' | 'hover' | 'pressed';
export type Mode = 'editor' | 'preview';

export interface EditorState {
  inter?: Interaction;
  selected?: boolean;
  focused?: boolean;
  /** being dragged: adds the lift shadow */
  lifted?: boolean;
  /** menu rows: keyboard-active ring drawn inside the row instead of outside */
  inset?: boolean;
}

const BRAND = 'var(--color-brand)';
const SOFT = 'var(--color-brand-border)'; // #9cc8ee
const GAP = 'var(--color-surface)'; // white gap between ring and focus
const LIFT = 'var(--shadow-lift)';

/** Returns a box-shadow value ('' = none). */
export function editorRing(
  { inter = 'default', selected = false, focused = false, lifted = false, inset = false }: EditorState,
  mode: Mode = 'editor',
  disabled = false,
): string {
  if (disabled) return ''; // disabled: no editor layer at all
  if (mode === 'preview') return lifted ? LIFT : ''; // preview: no editor layer
  if (inset) return focused ? `inset 0 0 0 2px ${BRAND}` : '';

  const layers: string[] = [];
  let w = 0;
  if (selected) {
    layers.push(`0 0 0 2px ${BRAND}`); // strongest, persists
    w = 2;
  } else if (inter === 'pressed') {
    layers.push(`0 0 0 1px ${BRAND}`); // only while the pointer is down
    w = 1;
  } else if (inter === 'hover') {
    layers.push(`0 0 0 1px ${SOFT}`); // temporary
    w = 1;
  }
  if (focused) layers.push(`0 0 0 ${w + 2}px ${GAP}`, `0 0 0 ${w + 4}px ${BRAND}`); // always outside
  if (lifted) layers.push(LIFT);
  return layers.join(', ');
}

/** Drop targets are dashed outlines, so they never read as selected. */
export type DropState = 'none' | 'valid' | 'invalid';

export function dropStyle(drop: DropState, mode: Mode = 'editor'): CSSProperties {
  if (drop === 'none' || mode === 'preview') return {};
  const valid = drop === 'valid';
  return {
    outline: `1.5px dashed ${valid ? BRAND : 'var(--color-error)'}`,
    outlineOffset: 3,
    background: valid ? 'var(--color-brand-tint)' : 'var(--color-error-bg)',
  };
}

/** Dragged copy: selected ring + lift + a slight tilt. */
export const DRAG_TILT = 'rotate(-1.2deg)';
