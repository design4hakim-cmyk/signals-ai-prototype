import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChangedDot, Checkbox, CopilotBadge, DragHandle, KitButton, Message, MoreButton, RailAddButton, type KitButtonVariant } from '../controls';
import { Board, Matrix, Tile, Wrap } from './Matrix';

/* Atoms sheet §3: buttons, icon controls, checkbox, badges and messages. */

const meta: Meta = { title: 'Canvas builder/3 Controls', parameters: { layout: 'fullscreen' } };
export default meta;

const COLS = ['Default', 'Hover', 'Pressed', 'Focused', 'Disabled'] as const;
const force = (c: (typeof COLS)[number]) => (c === 'Hover' ? 'hover' : c === 'Pressed' ? 'pressed' : c === 'Focused' ? 'focused' : undefined);
const LABEL: Record<KitButtonVariant, string> = { primary: '+ Add Entry Condition', secondary: 'Cancel', tertiary: 'Remove maths', destructive: 'Delete' };

/** App chrome keeps its own fills; pressed is darker than hover; focus is the editor ring. */
export const Buttons: StoryObj = {
  render: () => (
    <Board title="Buttons" note="Primary · Secondary (white, grey edge) · Tertiary (blue text) · Destructive (red text, light red on hover).">
      <Matrix
        rows={['primary', 'secondary', 'tertiary', 'destructive'] as const}
        cols={[...COLS, 'Loading'] as const}
        render={(v, c) =>
          c === 'Loading' ? (
            v === 'primary' ? <KitButton variant="primary" loading>Adding…</KitButton> : null
          ) : (
            <KitButton variant={v} force={force(c)} disabled={c === 'Disabled'}>{LABEL[v]}</KitButton>
          )
        }
      />
    </Board>
  ),
};

/** Editor-only: hidden in Preview. The + on the rail is solid blue so the next condition is one obvious click away. */
export const IconControls: StoryObj = {
  render: () => (
    <Board title="Icon controls">
      <div className="flex flex-col gap-6">
        <Wrap>
          {COLS.map((c) => (
            <Tile key={c} label={`+ · ${c.toLowerCase()}`}><RailAddButton label="Add condition" force={force(c)} disabled={c === 'Disabled'} /></Tile>
          ))}
        </Wrap>
        <Wrap>
          {COLS.filter((c) => c !== 'Disabled').map((c) => (
            <Tile key={c} label={`⋯ · ${c.toLowerCase()}`}><MoreButton force={force(c)} /></Tile>
          ))}
          <Tile label="⋯ · open"><MoreButton open /></Tile>
        </Wrap>
        <Wrap>
          <Tile label="⋮⋮ · default"><DragHandle /></Tile>
          <Tile label="⋮⋮ · hover"><DragHandle force="hover" /></Tile>
          <Tile label="⋮⋮ · focused"><DragHandle force="focused" /></Tile>
          <Tile label="⋮⋮ · dragging"><DragHandle dragging /></Tile>
          <Tile label="⋮⋮ · disabled"><DragHandle disabled /></Tile>
        </Wrap>
      </div>
    </Board>
  ),
};

/** Selection control for blocks and groups. */
export const CheckboxStates: StoryObj = {
  render: () => (
    <Board title="Checkbox">
      <Wrap>
        <Tile label="Off"><Checkbox label="Select" /></Tile>
        <Tile label="Off · hover"><Checkbox label="Select" force="hover" /></Tile>
        <Tile label="Off · focused"><Checkbox label="Select" force="focused" /></Tile>
        <Tile label="On"><Checkbox label="Select" checked /></Tile>
        <Tile label="On · hover"><Checkbox label="Select" checked force="hover" /></Tile>
        <Tile label="Indeterminate"><Checkbox label="Select" indeterminate /></Tile>
        <Tile label="Disabled · off"><Checkbox label="Select" disabled /></Tile>
        <Tile label="Disabled · on"><Checkbox label="Select" checked disabled /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Provenance and messages sit on top of any state. */
export const BadgesAndMessages: StoryObj = {
  render: () => (
    <Board title="Badges and messages">
      <Wrap gap={10}>
        <Tile label="Added by Copilot"><CopilotBadge /></Tile>
        <Tile label="Changed since update · editor only"><ChangedDot /></Tile>
        <Tile label="Error message"><Message tone="error">Finish this condition to update the chart</Message></Tile>
        <Tile label="Success message"><Message tone="success">Condition complete</Message></Tile>
      </Wrap>
    </Board>
  ),
};
