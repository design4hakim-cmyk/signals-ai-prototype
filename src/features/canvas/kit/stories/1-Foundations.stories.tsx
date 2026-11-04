import type { Meta, StoryObj } from '@storybook/react-vite';
import { dropStyle, editorRing, type EditorState } from '../editorRing';
import { EditorModeContext } from '../useEditorState';
import { Board, Tile, Wrap } from './Matrix';
import { EmaCross, HalfBuilt, Rsi } from './fixtures';

/* Atoms sheet §1 · Foundations: the editor-layer tokens, precedence, Editor vs Preview. */

const meta: Meta = { title: 'Canvas builder/1 Foundations', parameters: { layout: 'fullscreen' } };
export default meta;

const TOKENS: [string, EditorState | 'drop' | 'invalid', string][] = [
  ['Default', {}, 'The component’s own look, untouched.'],
  ['Hover', { inter: 'hover' }, 'Temporary. Interactive canvas elements only.'],
  ['Pressed', { inter: 'pressed' }, 'Only while the pointer is down.'],
  ['Selected', { selected: true }, 'Persists after the pointer leaves. Strongest.'],
  ['Focused', { focused: true }, 'Keyboard focus only. Sits outside any other ring.'],
  ['Selected + focused', { selected: true, focused: true }, 'Both visible; neither replaces the other.'],
  ['Drop target', 'drop', 'Dashed, so never read as selected.'],
  ['Invalid drop', 'invalid', 'With the reason in words.'],
  ['Dragging', { selected: true, lifted: true }, 'Selected ring + lift + slight tilt.'],
];

/** Every editor state, drawn by the one editorRing() helper. */
export const EditorRingTokens: StoryObj = {
  render: () => (
    <Board title="Editor interaction tokens" note="Drawn outside the element’s border, from editorRing() only. Built from the existing blue (#0782DA) and soft blue (#9CC8EE).">
      <div className="grid w-max grid-cols-[180px_90px_1fr] items-center gap-x-6 gap-y-5 rounded-card border border-border-control bg-surface p-6">
        {TOKENS.map(([name, s, rule]) => (
          <div key={name} className="contents">
            <span className="text-body font-medium">{name}</span>
            <span
              className="block h-7 w-14 rounded-chip border border-border-control bg-surface"
              style={
                s === 'drop'
                  ? dropStyle('valid')
                  : s === 'invalid'
                    ? dropStyle('invalid')
                    : { boxShadow: editorRing(s), transform: s.lifted ? 'rotate(-1.2deg)' : undefined }
              }
            />
            <span className="text-label text-text-tertiary">{rule}</span>
          </div>
        ))}
      </div>
    </Board>
  ),
};

/** When states meet: semantic look always shows under the ring; disabled has no layer. */
export const Precedence: StoryObj = {
  render: () => (
    <Board title="Precedence" note="Disabled overrides everything · the red, violet, dashed or grey stays under every ring · selected > pressed > hover · focus is added outside, independently.">
      <Wrap>
        <Tile label="Error + selected: both visible"><HalfBuilt selected /></Tile>
        <Tile label="Copilot + hover: violet stays, blue outside"><Rsi look="copilot" force={{ inter: 'hover' }} /></Tile>
        <Tile label="Copilot + selected + focused"><Rsi look="copilot" selected force={{ focused: true }} /></Tile>
        <Tile label="Disabled + 'selected': no editor layer"><Rsi look="disabled" selected /></Tile>
        <Tile label="Selected beats hover (one inner ring)"><Rsi selected force={{ inter: 'hover' }} /></Tile>
      </Wrap>
    </Board>
  ),
};

/** The same blocks in both modes: preview drops every ring, checkbox, ⋯, ⋮⋮ and change dot. */
export const EditorVsPreview: StoryObj = {
  render: () => (
    <Board title="Editor vs Preview" note="Same component states; only the editor layer differs. Error, values and the Copilot mark stay in Preview.">
      <Wrap gap={16}>
        {(['editor', 'preview'] as const).map((mode) => (
          <EditorModeContext.Provider key={mode} value={mode}>
            <Tile label={mode === 'editor' ? 'Editor mode' : 'Preview mode'}>
              <div className="flex flex-col gap-3">
                <EmaCross changed />
                <Rsi selected />
                <Rsi look="copilot" force={{ inter: 'hover' }} />
                <HalfBuilt />
              </div>
            </Tile>
          </EditorModeContext.Provider>
        ))}
      </Wrap>
    </Board>
  ),
};
