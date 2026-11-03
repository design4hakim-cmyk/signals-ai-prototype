import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldAtom } from '../atoms';
import { ConditionBlock } from '../ConditionBlock';
import { LogicGroup, Rail } from '../tree';
import { Board, Tile, Wrap } from './Matrix';
import { CloseAboveMa, EmaCross, Rsi, StochUp, VolumeSpike, WmaAboveMa } from './fixtures';
import { EDITOR_COLS, FORCE } from './states';

/* Atoms-2 sheet §5 · Logic and groups: All of · Any of · None of, written once per group. */

const meta: Meta = { title: 'Canvas builder/6 Logic and groups', parameters: { layout: 'fullscreen' } };
export default meta;

// rows go straight into the rail (one child per row), so this returns a list, not a fragment
const pair = () => [<CloseAboveMa key="close" />, <StochUp key="stoch" />];

/** The node sits on the group's edge; nothing repeats inside. */
export const ThreeKinds: StoryObj = {
  render: () => (
    <Board title="Three kinds">
      <Wrap>
        <LogicGroup word="All of">{pair()}</LogicGroup>
        <LogicGroup word="Any of">{pair()}</LogicGroup>
        <LogicGroup word="None of">
          <ConditionBlock label="RSI Less Than 70">
            <FieldAtom kind="operand" label="RSI" detail="(14)" />
            <FieldAtom kind="relation" label="Less Than" />
            <FieldAtom kind="value" label="70" />
          </ConditionBlock>
          <ConditionBlock label="Close Less Than VWAP">
            <FieldAtom kind="operand" label="Close" />
            <FieldAtom kind="relation" label="Less Than" />
            <FieldAtom kind="operand" label="VWAP" />
          </ConditionBlock>
        </LogicGroup>
      </Wrap>
    </Board>
  ),
};

/** Own look stays dashed grey. Hover marks the group under the pointer; selected is the 2px ring with ☑, ⋯ and ⋮⋮. */
export const GroupStates: StoryObj = {
  render: () => (
    <Board title="Group states">
      <Wrap gap={8}>
        {EDITOR_COLS.map((c) => (
          <Tile key={c} label={c}>
            <LogicGroup selected={FORCE[c].selected} force={FORCE[c]}>{pair()}</LogicGroup>
          </Tile>
        ))}
        <Tile label="Logic menu open · only the node is selected">
          <LogicGroup nodeOpen>{pair()}</LogicGroup>
        </Tile>
        <Tile label="Can join the selection">
          <LogicGroup joinable="canJoin">{pair()}</LogicGroup>
        </Tile>
      </Wrap>
    </Board>
  ),
};

/** Selection belongs to one level. Parent selected: children unchanged. Child selected: parent unchanged. */
export const SelectionHierarchy: StoryObj = {
  render: () => (
    <Board title="Selection hierarchy">
      <Wrap gap={8}>
        <Tile label="Group selected · its blocks stay neutral">
          <LogicGroup selected>{pair()}</LogicGroup>
        </Tile>
        <Tile label="Block selected · its group stays neutral">
          <LogicGroup><CloseAboveMa selected /><StochUp /></LogicGroup>
        </Tile>
        <Tile label="Nested group selected · parent and children neutral">
          <LogicGroup word="Any of">
            <CloseAboveMa />
            <LogicGroup word="All of" selected><VolumeSpike /><WmaAboveMa /></LogicGroup>
          </LogicGroup>
        </Tile>
      </Wrap>
    </Board>
  ),
};

/** Valid target: dashed blue + an insert line. Invalid: dashed red with the reason. */
export const DragAndDrop: StoryObj = {
  render: () => (
    <Board title="Drag and drop" note="Max nesting is 2 levels. A group can't be dropped into a level-2 group; a single condition can.">
      <Wrap gap={8}>
        <Tile label="Valid · insert line shows the spot">
          <LogicGroup drop="valid">
            <CloseAboveMa />
            <StochUp />
          </LogicGroup>
        </Tile>
        <Tile label="Valid · empty group">
          <LogicGroup drop="valid">
            <div className="flex h-10 w-[300px] items-center rounded-block border border-dashed border-brand px-3 text-label font-medium text-brand-text">Drop a condition here</div>
          </LogicGroup>
        </Tile>
        <Tile label="Invalid · too deep">
          <LogicGroup word="All of" drop="invalid" dropReason="Groups go 2 levels deep. Drop it next to the group instead.">
            <VolumeSpike />
            <WmaAboveMa />
          </LogicGroup>
        </Tile>
        <Tile label="Group being dragged">
          <LogicGroup dragging>{pair()}</LogicGroup>
        </Tile>
      </Wrap>
      <Tile label="Insert line on the rail (where the dragged block will land)">
        <div className="rounded-card bg-surface p-4">
          <Rail insertAt={1}>
            <EmaCross />
            <Rsi />
          </Rail>
        </div>
      </Tile>
    </Board>
  ),
};
