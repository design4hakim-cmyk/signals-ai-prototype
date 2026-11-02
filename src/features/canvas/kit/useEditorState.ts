import { createContext, useContext, useEffect, useId, useState, type FocusEvent, type PointerEvent } from 'react';
import { create } from 'zustand';
import type { EditorState, Interaction, Mode } from './editorRing';

/*
  Live interaction for canvas elements, fed into editorRing().
    • Hover marks only the INNERMOST element under the pointer (§0 rule 4):
      one document listener finds the closest [data-editor-el] to the pointer.
    • Pressed lasts only while the pointer is down on that same element.
    • Focused = keyboard focus (:focus-visible), never a mouse click.
  Stories can force any state with the `force` argument instead.
*/

const useHover = create<{ id: string | null }>(() => ({ id: null }));
let listening = false;
function listen() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as Element | null)?.closest?.('[data-editor-el]') as HTMLElement | null;
    useHover.setState({ id: el?.dataset.editorEl ?? null });
  });
  // pointer left the window
  document.addEventListener('pointerout', (e) => !e.relatedTarget && useHover.setState({ id: null }));
}

/** Editor or Preview (§0 table). Preview hides rings, checkboxes, ⋯, ⋮⋮, + and the change dot. */
export const EditorModeContext = createContext<Mode>('editor');
export const useEditorMode = () => useContext(EditorModeContext);

export function useEditorState(force: EditorState | undefined, disabled = false) {
  const id = useId();
  const mode = useEditorMode();
  const hovered = useHover((s) => s.id === id);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(listen, []);

  useEffect(() => {
    if (!pressed) return;
    const up = () => setPressed(false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [pressed]);

  const live: Interaction = disabled ? 'default' : pressed ? 'pressed' : hovered ? 'hover' : 'default';
  const state: EditorState = {
    inter: force?.inter ?? live,
    selected: force?.selected ?? false,
    focused: force?.focused ?? (focused && !disabled),
    lifted: force?.lifted,
  };

  const props = {
    'data-editor-el': id,
    onPointerDown: (e: PointerEvent) => {
      if (disabled) return;
      // only the innermost editor element counts as pressed
      if ((e.target as Element).closest('[data-editor-el]') === e.currentTarget) setPressed(true);
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) setFocused(true);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => e.target === e.currentTarget && setFocused(false),
  };

  return { state, mode, props, active: state.inter !== 'default' || !!state.selected };
}
