import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArithmeticMenu, BlockMenu, GroupMenu, IndicatorPicker, IndicatorSettings, LogicMenu, MenuRow, MenuSurface, RelationMenu, TimingMenu, type RowState } from '../menus';
import { CanvasToast, SelectionBar } from '../tree';
import { Board, Tile, Wrap } from './Matrix';

/* Atoms sheet §3 menus + behaviour sheet §1 popovers, selection bar and toast. */

const meta: Meta = { title: 'Canvas builder/4 Menus and popovers', parameters: { layout: 'fullscreen' } };
export default meta;

const ROWS: [RowState | undefined, boolean, string][] = [
  [undefined, false, 'Default'],
  ['hover', false, 'Hover · neutral grey'],
  ['pressed', false, 'Pressed · darker grey'],
  ['keyboard', false, 'Keyboard active · focus ring'],
  ['current', false, 'Selected · blue tint, blue text, ✓'],
  ['disabled', false, 'Disabled · muted, no hover'],
  [undefined, true, 'Destructive · red text'],
  ['hover', true, 'Destructive hover · light red'],
  ['pressed', true, 'Destructive pressed'],
];

/** Hover is grey, current is a blue tint with ✓, keyboard active is the ring. Delete stays red. */
export const MenuRows: StoryObj = {
  render: () => (
    <Board title="Menu rows">
      <div className="flex gap-4">
        <MenuSurface width={240} label="Row states">
          <div className="flex flex-col gap-1 p-1">
            {ROWS.map(([s, d, l]) => (
              <MenuRow key={l} state={s} destructive={d} shortcut={d ? '⌫' : undefined}>{d ? 'Delete' : 'Greater Than'}</MenuRow>
            ))}
          </div>
        </MenuSurface>
        <div className="flex flex-col gap-1 pt-1">
          {ROWS.map(([, , l]) => (
            <span key={l} className="flex h-9 items-center text-hint text-text-tertiary">{l}</span>
          ))}
        </div>
      </div>
    </Board>
  ),
};

/** Rare actions only; edit by clicking the fields. Select is the checkbox, not here. */
export const MoreMenus: StoryObj = {
  render: () => (
    <Board title="⋯ menus">
      <Wrap>
        <Tile label="On a block"><BlockMenu /></Tile>
        <Tile label="Row hover"><BlockMenu hoverRow={0} /></Tile>
        <Tile label="On a group"><GroupMenu /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Search is focused on open. Favourites first; the current indicator carries a ✓. Matches in bold. */
export const IndicatorPickerStates: StoryObj = {
  render: () => (
    <Board title="Indicator picker">
      <Wrap>
        <Tile label="Open · row hover"><IndicatorPicker hoverRow={0} /></Tile>
        <Tile label="Searching · keyboard on first match"><IndicatorPicker query="rsi" /></Tile>
        <Tile label="Switching · current ✓"><IndicatorPicker current="EMA" /></Tile>
        <Tile label="No results"><IndicatorPicker query="xyz" /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Changes apply as you type; bad input shows the reason and keeps the last good value. */
export const Settings: StoryObj = {
  render: () => (
    <Board title="Indicator settings">
      <Wrap>
        <Tile label="Typing in Length"><IndicatorSettings typing /></Tile>
        <Tile label="Error on the field"><IndicatorSettings length="0" error="Length must be 1 or more" /></Tile>
      </Wrap>
    </Board>
  ),
};

export const Relation: StoryObj = {
  render: () => (
    <Board title="Relation" note="Two groups so crosses aren't lost among comparisons.">
      <Wrap>
        <Tile label="Current ✓"><RelationMenu current="Cross Above" /></Tile>
        <Tile label="Hover"><RelationMenu current="Cross Above" hoverRow="Less Than" /></Tile>
      </Wrap>
    </Board>
  ),
};

export const ArithmeticLogicTiming: StoryObj = {
  name: 'Arithmetic, logic node, timing',
  render: () => (
    <Board title="Arithmetic · Logic node · Timing" note="Arithmetic: operator and amount; shows as × 1.5 on the operand. Logic node only switches the logic; group actions live in the group's ⋯.">
      <Wrap>
        <Tile label="Arithmetic · open"><ArithmeticMenu /></Tile>
        <Tile label="Logic node · on a group"><LogicMenu current="Any of" /></Tile>
        <Tile label="Logic node · section root"><LogicMenu current="All of" onGroup={false} /></Tile>
        <Tile label="Timing chip"><TimingMenu /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Float at the bottom of the canvas, same surface as the popovers. No dark bars. */
export const SelectionBarAndToast: StoryObj = {
  render: () => (
    <Board title="Selection bar and toast">
      <div className="flex flex-col items-start gap-5">
        <Tile label="One ticked · grouping waits"><SelectionBar count={1} /></Tile>
        <Tile label="Two ticked"><SelectionBar count={2} /></Tile>
        <Tile label="After delete"><CanvasToast text="Deleted RSI (14) Greater Than 50" onUndo={() => {}} /></Tile>
        <Tile label="After grouping"><CanvasToast text="Grouped 2 conditions as Any of" onUndo={() => {}} /></Tile>
      </div>
    </Board>
  ),
};
