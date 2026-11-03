import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldAtom } from '../atoms';
import { ConditionBlock } from '../ConditionBlock';
import { LogicGroup, SectionShell } from '../tree';
import { EditorModeContext } from '../useEditorState';
import { Board, Tile, Wrap } from './Matrix';
import { CloseAboveMa, EmaCross, HalfBuilt, Rsi, StochUp, VolumeSpike, WmaAboveMa } from './fixtures';
import { EDITOR_COLS, FORCE } from './states';

/* Atoms-2 sheet §6 Section shell + §7 Editor vs Preview. */

const meta: Meta = { title: 'Canvas builder/7 Sections', parameters: { layout: 'fullscreen' } };
export default meta;

/** Header, timing and one big add button. */
export const Empty: StoryObj = {
  render: () => (
    <Board title="Empty sections">
      <Wrap gap={4}>
        <SectionShell side="entry" />
        <SectionShell side="exit" />
      </Wrap>
    </Board>
  ),
};

/** No border of its own. The editor layer shows only for the section itself — never because a child is selected. */
export const States: StoryObj = {
  render: () => (
    <Board title="Section states">
      <Wrap gap={6}>
        {EDITOR_COLS.filter((c) => c !== 'Pressed').map((c) => (
          <Tile key={c} label={c}>
            <SectionShell side="entry" selected={FORCE[c].selected} force={FORCE[c]}><EmaCross /></SectionShell>
          </Tile>
        ))}
        <Tile label="Drop target">
          <SectionShell side="entry" drop="valid"><EmaCross /></SectionShell>
        </Tile>
        <Tile label="Child selected · section unchanged">
          <SectionShell side="entry"><EmaCross selected /></SectionShell>
        </Tile>
      </Wrap>
    </Board>
  ),
};

/** The 8-condition case. The tree grows down; long blocks wrap. */
export const ManyConditions: StoryObj = {
  render: () => (
    <Board title="Many conditions">
      <SectionShell side="entry" word="All of">
        <EmaCross />
        <Rsi />
        <LogicGroup word="Any of">
          <CloseAboveMa />
          <StochUp />
          <LogicGroup word="All of"><VolumeSpike /><WmaAboveMa /></LogicGroup>
        </LogicGroup>
        <LogicGroup word="None of">
          <ConditionBlock label="Close Greater Than Bollinger Band Upper">
            <FieldAtom kind="operand" label="Close" />
            <FieldAtom kind="relation" label="Greater Than" />
            <FieldAtom kind="operand" label="Bollinger Band" detail="(20, 2, Close, SMA) · Upper" />
          </ConditionBlock>
          <ConditionBlock label="RSI Less Than 70">
            <FieldAtom kind="operand" label="RSI" detail="(14)" />
            <FieldAtom kind="relation" label="Less Than" />
            <FieldAtom kind="value" label="70" />
          </ConditionBlock>
        </LogicGroup>
      </SectionShell>
    </Board>
  ),
};

/** Editor: selected, hovered Copilot, changed and incomplete blocks. Preview drops every ring, checkbox, ⋯, ⋮⋮, + and dot. */
export const EditorVsPreview: StoryObj = {
  render: () => (
    <Board title="Editor vs Preview" note="Same strategy, same component states; only the editor layer differs.">
      <Wrap gap={10}>
        {(['editor', 'preview'] as const).map((mode) => (
          <EditorModeContext.Provider key={mode} value={mode}>
            <Tile label={mode === 'editor' ? 'Editor mode' : 'Preview mode'}>
              <SectionShell side="entry">
                <EmaCross changed />
                <Rsi look="copilot" force={{ inter: 'hover' }} />
                <LogicGroup word="Any of">
                  <CloseAboveMa selected />
                  <StochUp />
                </LogicGroup>
                <HalfBuilt />
              </SectionShell>
            </Tile>
          </EditorModeContext.Provider>
        ))}
      </Wrap>
    </Board>
  ),
};
