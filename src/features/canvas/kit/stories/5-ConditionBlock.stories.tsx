import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldAtom } from '../atoms';
import { ConditionBlock } from '../ConditionBlock';
import { Board, Matrix, Tile, Wrap } from './Matrix';
import { HalfBuiltFields, Rsi, RsiFields } from './fixtures';
import { EDITOR_COLS, FORCE } from './states';

/* Atoms-2 sheet §4 · Condition block. Rows: the block's own look. Columns: the editor layer on top. */

const meta: Meta = { title: 'Canvas builder/5 Condition block', parameters: { layout: 'fullscreen' } };
export default meta;

const LOOKS = ['Normal', 'Error', 'Copilot', 'Changed since update', 'Disabled'] as const;

/** Every own look × every editor state. */
export const StateMatrix: StoryObj = {
  render: () => (
    <Board title="Condition block" note="Controls show on hover, press or selection: ☐ at the start, ⋯ then ⋮⋮ at the far right. Copilot ✦ and red error stay under every ring.">
      <Matrix
        rows={LOOKS}
        cols={EDITOR_COLS}
        render={(row, c) => {
          const f = FORCE[c];
          if (row === 'Disabled')
            return c === 'Default' ? (
              <ConditionBlock look="disabled" label="RSI">
                <FieldAtom kind="operand" semantic="disabled" label="RSI" detail="(14)" />
                <FieldAtom kind="relation" semantic="disabled" label="Greater Than" />
                <FieldAtom kind="value" semantic="disabled" label="50" />
              </ConditionBlock>
            ) : (
              <span className="text-hint text-text-subtle">no response</span>
            );
          if (row === 'Error')
            return (
              <ConditionBlock look="error" label="EMA, half built" error="Finish this condition to update the chart" selected={f.selected} force={f}>
                <HalfBuiltFields />
              </ConditionBlock>
            );
          return (
            <ConditionBlock look={row === 'Copilot' ? 'copilot' : 'normal'} changed={row === 'Changed since update'} label="RSI" selected={f.selected} force={f}>
              <RsiFields />
            </ConditionBlock>
          );
        }}
      />
    </Board>
  ),
};

/** The open field gets the selected ring; the block around it does not change. */
export const EditingAField: StoryObj = {
  render: () => (
    <Board title="Editing a field">
      <Wrap>
        <Tile label="New · picking indicator">
          <ConditionBlock label="New condition">
            <FieldAtom kind="operand" semantic="empty" label="Indicator" open />
            <FieldAtom kind="relation" semantic="empty" label="Relation" />
            <FieldAtom kind="value" semantic="empty" label="Indicator" />
          </ConditionBlock>
        </Tile>
        <Tile label="Half built · picking relation">
          <ConditionBlock label="Half built">
            <FieldAtom kind="operand" label="EMA" detail="(9, Close)" />
            <FieldAtom kind="relation" semantic="empty" label="Relation" open />
            <FieldAtom kind="value" semantic="empty" label="Indicator" />
          </ConditionBlock>
        </Tile>
        <Tile label="Switching an indicator">
          <ConditionBlock label="RSI">
            <FieldAtom kind="operand" label="RSI" detail="(14)" open />
            <FieldAtom kind="relation" label="Greater Than" />
            <FieldAtom kind="value" label="50" />
          </ConditionBlock>
        </Tile>
      </Wrap>
    </Board>
  ),
};

/** Once one block is ticked, the blocks that can join show their box. The rest dim to 0.5. */
export const SelectionMode: StoryObj = {
  render: () => (
    <Board title="Selection mode">
      <Wrap>
        <Tile label="Ticked"><Rsi selected /></Tile>
        <Tile label="Can join"><Rsi joinable="canJoin" /></Tile>
        <Tile label="Can join + hover"><Rsi joinable="canJoin" force={{ inter: 'hover' }} /></Tile>
        <Tile label="Can’t join · other level"><Rsi joinable="cantJoin" /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Source: faded, dashed grey, no ring. Moving copy: selected ring and lift. They never look the same. */
export const Drag: StoryObj = {
  render: () => (
    <Board title="Drag">
      <Wrap gap={10}>
        <Tile label="Source"><Rsi look="dragSource" /></Tile>
        <Tile label="Moving copy"><Rsi dragging /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Live: hover, press, Tab to focus, tick the checkbox — no forced states. */
export const Interactive: StoryObj = {
  render: function Live() {
    return (
      <Board title="Try it" note="Hover, press, Tab to focus. Hover marks only the innermost element under the pointer.">
        <Wrap>
          <Rsi />
          <ConditionBlock look="copilot" label="Copilot RSI"><RsiFields /></ConditionBlock>
          <ConditionBlock look="error" label="Half built" error="Finish this condition to update the chart"><HalfBuiltFields /></ConditionBlock>
        </Wrap>
      </Board>
    );
  },
};
