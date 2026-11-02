import type { EditorState } from '../editorRing';

/** The editor-state columns used across every matrix (COMPONENTS.md §0). */
export const EDITOR_COLS = ['Default', 'Hover', 'Pressed', 'Selected', 'Focused', 'Selected + focused'] as const;
export type EditorCol = (typeof EDITOR_COLS)[number];

export const FORCE: Record<EditorCol, EditorState> = {
  Default: {},
  Hover: { inter: 'hover' },
  Pressed: { inter: 'pressed' },
  Selected: { selected: true },
  Focused: { focused: true },
  'Selected + focused': { selected: true, focused: true },
};
