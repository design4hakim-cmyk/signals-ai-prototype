// Signals AI · canvas builder · state logic (reference for the build).
// Two layers: the element's OWN look (semantic) + a separate Figma-like EDITOR layer (blue rings outside the border).
// Colours below are the existing product palette; when building, move them into src/styles/tokens.css and read them there.

export const color = {
  brand: '#0782DA', brandHover: '#066FBB', brandPressed: '#05609F', brandSoft: '#9CC8EE', brandTint: '#F4F8FD', menuCurrent: '#EEF5FC', brandText: '#0A5FA3',
  text: '#1D1F24', textSub: '#4A4F57', textMuted: '#6B717A', textPlaceholder: '#8A9099', textFaint: '#A1A6AD',
  chip: '#F1F2F4', rowPressed: '#E9EBEE', border: '#E4E6EA', borderStrong: '#B9C0C9', borderDashed: '#B3B8BF', groupEdge: '#C3C8CF', groupBg: '#FCFCFD',
  readonlyBg: '#FAFBFC', disabledBg: '#F7F8FA', disabledBorder: '#ECECEF',
  error: '#B42318', errorBg: '#FDF4F4', errorPressed: '#FBECEB',
  ai: '#6E56CF', aiBorder: '#B9A8F7', aiBg: '#EFEAFF', aiSoft: '#D6CBFA',   // Copilot provenance only
  success: '#2F8A4E', successBg: '#EAF6EE', star: '#F0B429',
} as const;

// ---------- editor layer ----------
export type Interaction = 'default' | 'hover' | 'pressed';
export interface EditorState { inter?: Interaction; selected?: boolean; focused?: boolean; lifted?: boolean }
export type Mode = 'editor' | 'preview';

/** The only place rings are computed. Returns a box-shadow value ('' = none). */
export function editorRing({ inter = 'default', selected = false, focused = false, lifted = false }: EditorState, mode: Mode = 'editor', disabled = false): string {
  const lift = '0 12px 28px rgba(20,22,28,0.18)';
  if (disabled) return '';                            // disabled: no editor layer at all
  if (mode === 'preview') return lifted ? lift : '';  // preview: no editor layer
  const layers: string[] = [];
  let w = 0;
  if (selected) { layers.push(`0 0 0 2px ${color.brand}`); w = 2; }          // strongest, persists
  else if (inter === 'pressed') { layers.push(`0 0 0 1px ${color.brand}`); w = 1; }
  else if (inter === 'hover') { layers.push(`0 0 0 1px ${color.brandSoft}`); w = 1; }
  if (focused) layers.push(`0 0 0 ${w + 2}px #FFFFFF`, `0 0 0 ${w + 4}px ${color.brand}`); // always outside
  if (lifted) layers.push(lift);
  return layers.join(', ');
}
export const dropOutline = { valid: `1.5px dashed ${color.brand}`, invalid: `1.5px dashed ${color.error}`, offset: '3px' };

// ---------- own look of field atoms (never changes with interaction) ----------
export type AtomFamily = 'operand' | 'connector';   // operand = indicator, value · connector = relation, arithmetic, logic node, timing
export type Semantic = 'normal' | 'empty' | 'error' | 'readonly' | 'disabled';
type Look = { bg: string; border: string; text: string };
export function atomLook(family: AtomFamily, semantic: Semantic): Look {
  switch (semantic) {
    case 'empty':    return { bg: '#FFFFFF', border: `1px dashed ${color.borderDashed}`, text: color.textPlaceholder };
    case 'error':    return { bg: color.errorBg, border: `1px solid ${color.error}`, text: color.error };
    case 'readonly': return { bg: color.readonlyBg, border: `1px solid ${color.border}`, text: color.text };
    case 'disabled': return { bg: color.disabledBg, border: `1px solid ${color.disabledBorder}`, text: color.textFaint };
    default: return family === 'operand'
      ? { bg: 'transparent', border: '1px solid transparent', text: color.text }
      : { bg: color.chip, border: `1px solid ${color.chip}`, text: color.text };
  }
}

// ---------- own look of a condition block ----------
export type BlockSemantic = 'normal' | 'error' | 'copilot' | 'disabled' | 'dragSource';
export function blockLook(s: BlockSemantic): { bg: string; border: string; opacity?: number } {
  switch (s) {
    case 'error':      return { bg: color.errorBg, border: `1px solid ${color.error}` };
    case 'copilot':    return { bg: color.aiBg, border: `1px solid ${color.aiBorder}` };
    case 'disabled':   return { bg: color.disabledBg, border: `1px solid ${color.disabledBorder}` };
    case 'dragSource': return { bg: color.disabledBg, border: `1px dashed ${color.borderDashed}`, opacity: 0.5 };
    default:           return { bg: '#FFFFFF', border: `1px solid ${color.border}` };
  }
}
// A Copilot block that is also selected keeps its violet look + ✦; the selected ring goes outside it.
// A "changed since update" block shows an 8px brand dot top-right (editor mode only).
