// Signals AI · canvas builder · state logic for the field atoms (reference).
// Colours must come from src/styles/tokens.css when built; see the mapping table in COMPONENTS.md.
// AI colours are the repo's blue --color-ai-* tokens. No purple.

export const color = {
  blue500: '#0782DA', blue600: '#0567AD', blue10: '#E6F3FB', blueWash: '#F4F8FD', blueMenuCurrent: '#EEF5FC',
  buy: '#2F8A4E', buyTint: '#EAF6EE', sell: '#C2453D', sellTint: '#FBECEB', ai: '#0782DA', aiBorder: '#C4DFF5', aiTint: '#F4F8FD',
  text: '#1D1F24', textSub: '#4A4F57', textMuted: '#6B717A', textPlaceholder: '#8A9099', textFaint: '#A1A6AD',
  bgPage: '#FFFFFF', bgCanvas: '#FAFBFC', chipGrey: '#F1F2F4', chipDisabled: '#F7F8FA',
  borderCard: '#E4E6EA', borderPanel: '#ECECEF', borderButton: '#DFE1E5', borderDashed: '#B3B8BF',
  groupEdge: '#C3C8CF', groupBg: '#FCFCFD', rail: '#C9CED5', divider: '#F0F1F3',
  errorBg: '#FDF4F4', errorBorder: '#E5A3A0', errorText: '#B42318',
} as const;

export const focusRing = '0 0 0 3px rgba(7,130,218,0.15)';
export const popoverShadow = '0 12px 32px rgba(20,22,28,0.14)';

/** Field atoms come in two families. They differ ONLY at rest; every other state is shared. */
export type AtomFamily = 'operand' | 'connector'; // operand = indicator, value · connector = relation, arithmetic, logic node, timing chip
export type AtomState = 'default' | 'hover' | 'open' | 'empty' | 'emptyFocused' | 'error' | 'disabled';

type Look = { bg: string; border: string; text: string; ring?: boolean };
const shared: Record<Exclude<AtomState, 'default' | 'disabled'>, Look> = {
  hover:        { bg: color.blue10, border: `1px solid ${color.blue10}`, text: color.text },
  open:         { bg: '#FFFFFF', border: `1px solid ${color.blue500}`, text: color.text, ring: true }, // focused = pressed = menu open
  empty:        { bg: '#FFFFFF', border: `1px dashed ${color.borderDashed}`, text: color.textPlaceholder },
  emptyFocused: { bg: '#FFFFFF', border: `1px solid ${color.blue500}`, text: color.textPlaceholder, ring: true },
  error:        { bg: color.errorBg, border: `1px solid ${color.errorBorder}`, text: color.errorText },
};
export const atomLook: Record<AtomFamily, Record<AtomState, Look>> = {
  operand: {
    default:  { bg: 'transparent', border: '1px solid transparent', text: color.text },
    disabled: { bg: 'transparent', border: '1px solid transparent', text: color.textFaint },
    ...shared,
  },
  connector: {
    default:  { bg: color.chipGrey, border: `1px solid ${color.chipGrey}`, text: color.text },
    disabled: { bg: color.chipDisabled, border: `1px solid ${color.chipDisabled}`, text: color.textFaint },
    ...shared,
  },
};

export const size = { atomH: 28, atomRadius: 6, atomPadX: 8, blockRadius: 10, blockPad: 6, blockGap: 6, groupRadius: 12, menuRowH: 32, maxNesting: 2 } as const;
