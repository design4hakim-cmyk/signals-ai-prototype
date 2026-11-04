import type { Meta, StoryObj } from '@storybook/react-vite';
import { StrategiesPanel } from '../StrategiesPanel';
import { Board, PanelFrame, WithLibrary } from './helpers';

/*
  st-components §3 · The whole panel and its variants.
  These are the live panel (same component as the app), with the store set to each state —
  so hover, menus, rename, delete and the keyboard all work here too.
*/

const meta: Meta = { title: 'My Strategies/4 Panel', parameters: { layout: 'fullscreen' } };
export default meta;

/** Pinned sits beside the builder. */
export const Pinned: StoryObj = {
  render: () => (
    <WithLibrary state={{ expanded: ['SENSEX'] }}>
      <Board title="Pinned" note="Hover a row for Trade and ⋯ · click an index to expand · ↑ ↓ → ← Enter F2 ⌘D ⌫ · / to search.">
        <PanelFrame label="Pinned"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

/** Peek opens on hovering the folder icon and floats with a shadow. */
export const Peek: StoryObj = {
  render: () => (
    <WithLibrary state={{ expanded: ['SENSEX'] }}>
      <Board title="Peek">
        <PanelFrame label="Peek"><StrategiesPanel variant="peek" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

/** One open in the builder (blue). Hover another to see Trade and ⋯. */
export const PinnedOneOpen: StoryObj = {
  name: 'Pinned · one open in builder',
  render: () => (
    <WithLibrary state={{ expanded: ['SENSEX'], openId: 's-bcs' }}>
      <Board title="Pinned · one open in builder">
        <PanelFrame label="Bull Call Spread is open"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

/** Matches strategy names; indexes with matches open by themselves. Match is bold, never a blue fill. */
export const SearchResults: StoryObj = {
  render: () => (
    <WithLibrary state={{ query: 'rsi', expanded: [] }}>
      <Board title="Search · results">
        <PanelFrame label="Results"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

export const NoResults: StoryObj = {
  render: () => (
    <WithLibrary state={{ query: 'xyz' }}>
      <Board title="Search · no results">
        <PanelFrame label="No results"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

export const Empty: StoryObj = {
  render: () => (
    <WithLibrary state={{ strategies: [] }}>
      <Board title="Empty">
        <PanelFrame label="No saved strategies yet"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

export const Loading: StoryObj = {
  render: () => (
    <WithLibrary state={{ loading: true }}>
      <Board title="Loading">
        <PanelFrame label="Skeleton rows"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

export const Renaming: StoryObj = {
  render: () => (
    <WithLibrary state={{ expanded: ['SENSEX'], renamingId: 's-bps' }}>
      <Board title="Renaming in place" note="Type Iron Condor and press Enter to see the duplicate-name error; Esc cancels.">
        <PanelFrame label="Renaming Bear Put Spread"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

export const DeleteConfirmOpen: StoryObj = {
  name: 'Delete confirm (anchored to ⋯)',
  render: () => (
    <WithLibrary state={{ expanded: ['SENSEX'], confirmDeleteId: 's-bps' }}>
      <Board title="Delete confirm">
        <PanelFrame label="Delete Bear Put Spread?"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};

export const DeleteBlocked: StoryObj = {
  name: 'Running · delete blocked',
  render: () => (
    <WithLibrary state={{ expanded: ['SENSEX'], menuId: 's-bcs' }}>
      <Board title="⋯ on a running strategy">
        <PanelFrame label="Stop its 3 running trades first"><StrategiesPanel variant="pinned" /></PanelFrame>
      </Board>
    </WithLibrary>
  ),
};
