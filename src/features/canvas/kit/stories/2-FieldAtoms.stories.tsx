import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldAtom, TextInput, type AtomKind, type FieldAtomProps, type Semantic } from '../atoms';
import { ConditionBlock } from '../ConditionBlock';
import { Board, Matrix, Tile, Wrap } from './Matrix';
import { EDITOR_COLS, FORCE } from './states';

/* Atoms sheet §2 Field atoms + §3 Text input. */

const meta: Meta = { title: 'Canvas builder/2 Field atoms', parameters: { layout: 'fullscreen' } };
export default meta;

const SAMPLE: Record<AtomKind, Pick<FieldAtomProps, 'label' | 'detail'>> = {
  operand: { label: 'EMA', detail: '(9, Close)' },
  relation: { label: 'Cross Above' },
  value: { label: '50' },
  arithmetic: {},
  logic: { label: 'Any of' },
  timing: { label: 'On candle close' },
};
const KINDS = ['operand', 'relation', 'value', 'arithmetic', 'logic', 'timing'] as const;
const HINT = {
  operand: 'Indicator + settings in grey.',
  relation: 'How the two sides compare.',
  value: 'A number or a time.',
  arithmetic: 'Maths on an operand.',
  logic: 'All of · Any of · None of.',
  timing: 'When conditions are checked.',
};

/** Every atom × every editor state, plus disabled. */
export const AtomStates: StoryObj = {
  render: () => (
    <Board title="Field atoms" note="Own look by type; editor rings by state. Selected = its popover is open.">
      <Matrix
        rows={KINDS}
        cols={[...EDITOR_COLS, 'Disabled'] as const}
        rowHint={HINT}
        render={(k, c) => (c === 'Disabled' ? <FieldAtom kind={k} semantic="disabled" {...SAMPLE[k]} /> : <FieldAtom kind={k} force={FORCE[c]} {...SAMPLE[k]} />)}
      />
    </Board>
  ),
};

const SEMANTICS: Exclude<Semantic, 'normal'>[] = ['empty', 'error', 'readonly', 'disabled'];
const SEM_SAMPLE: Record<(typeof SEMANTICS)[number], Pick<FieldAtomProps, 'label' | 'detail' | 'kind'>> = {
  empty: { kind: 'operand', label: 'Indicator' },
  error: { kind: 'operand', label: 'Pick indicator' },
  readonly: { kind: 'value', label: '75', detail: '· lot size' },
  disabled: { kind: 'operand', label: 'EMA', detail: '(9, Close)' },
};

/** The semantic look (rows) never changes; the editor ring (columns) is added outside it. */
export const SemanticTimesEditor: StoryObj = {
  render: () => (
    <Board title="Semantic × editor" note="Empty is dashed until filled · Error: red stays under every ring · Read-only: focusable, never selected · Disabled: no editor layer.">
      <Matrix
        rows={SEMANTICS.map((s) => s[0].toUpperCase() + s.slice(1)) as unknown as readonly string[]}
        cols={['Default', 'Hover', 'Selected', 'Focused', 'Selected + focused'] as const}
        render={(row, c) => {
          const s = row.toLowerCase().replace('-', '') as (typeof SEMANTICS)[number];
          if (s === 'disabled' && c !== 'Default') return <span className="text-hint text-text-subtle">no response</span>;
          return <FieldAtom semantic={s} force={FORCE[c]} {...SEM_SAMPLE[s]} />;
        }}
      />
    </Board>
  ),
};

/** Typing is selected + focused. An error keeps its red and the rings while you type. */
export const ValueTypingAndErrors: StoryObj = {
  render: () => (
    <Board title="Value · typing and errors">
      <Wrap>
        <Tile label="Typing"><FieldAtom kind="value" label="50" force={{ selected: true, focused: true }} /></Tile>
        <Tile label="Out of range, still typing">
          <div className="flex flex-col gap-1">
            <FieldAtom kind="value" semantic="error" label="140" force={{ selected: true, focused: true }} />
            <span className="text-hint text-error">RSI runs 0 to 100</span>
          </div>
        </Tile>
        <Tile label="Out of range, after leaving"><FieldAtom kind="value" semantic="error" label="140" /></Tile>
        <Tile label="Time"><FieldAtom kind="value" label="14:00" /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Never truncated: the block wraps to a second line instead. */
export const LongOperands: StoryObj = {
  render: () => (
    <Board title="Long operands" note="Full name and settings, never truncated. The block wraps inside itself.">
      <Wrap>
        <Tile label="Full name and settings"><FieldAtom kind="operand" label="Bollinger Band" detail="(20, 2, Close, SMA, Offset 0) · Upper" /></Tile>
        <Tile label="Wraps inside its block">
          <div className="w-[460px]">
            <ConditionBlock label="Bollinger Band Cross Below Keltner Channel">
              <FieldAtom kind="operand" label="Bollinger Band" detail="(20, 2, Close, SMA, Offset 0) · Upper" />
              <FieldAtom kind="relation" label="Cross Below" />
              <FieldAtom kind="operand" label="Keltner Channel" detail="(20, 1.5, Close, EMA, ATR 10) · Upper" />
            </ConditionBlock>
          </div>
        </Tile>
      </Wrap>
    </Board>
  ),
};

/** Text input inside popovers. The error stays on the field, never on the popover. */
export const TextInputs: StoryObj = {
  render: () => (
    <Board title="Text input" note="Default, hover, focused, filled, error, disabled, read-only.">
      <Wrap>
        <Tile label="Default · empty"><TextInput placeholder="Length" aria-label="Length" /></Tile>
        <Tile label="Filled"><TextInput defaultValue="9" aria-label="Length" /></Tile>
        <Tile label="Hover"><TextInput defaultValue="9" force={{ inter: 'hover' }} aria-label="Length" /></Tile>
        <Tile label="Focused"><TextInput defaultValue="9" force={{ focused: true }} aria-label="Length" /></Tile>
        <Tile label="Error"><TextInput defaultValue="0" error aria-label="Length" /></Tile>
        <Tile label="Error + hover"><TextInput defaultValue="0" error force={{ inter: 'hover' }} aria-label="Length" /></Tile>
        <Tile label="Error + focused"><TextInput defaultValue="0" error="Length must be 1 or more" force={{ focused: true }} aria-label="Length" /></Tile>
        <Tile label="Disabled"><TextInput defaultValue="9" disabled aria-label="Length" /></Tile>
        <Tile label="Read-only"><TextInput defaultValue="75" readOnly aria-label="Lot size" /></Tile>
        <Tile label="Read-only + focused"><TextInput defaultValue="75" readOnly force={{ focused: true }} aria-label="Lot size" /></Tile>
      </Wrap>
    </Board>
  ),
};
