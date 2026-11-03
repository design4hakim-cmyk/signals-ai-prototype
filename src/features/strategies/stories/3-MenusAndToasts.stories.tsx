import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { TradePopup } from '@/features/trade/TradePopup';
import { useLibrary } from '@/store/library';
import { DeleteConfirm, RowMenu } from '../menus';
import { PanelToast } from '../parts';
import { Board, Wrap } from './helpers';

/* st-components §2 · ⋯ menu, delete confirm, toasts — plus the shared Trade popup */

const meta: Meta = { title: 'My Strategies/3 Menus, confirm, toasts', parameters: { layout: 'fullscreen' } };
export default meta;

const Cap = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <figure className="m-0 inline-flex flex-col gap-2">
    {children}
    <figcaption className="text-hint text-text-tertiary">{label}</figcaption>
  </figure>
);

/** Delete is disabled, with the reason, while anything runs. */
export const MoreMenu: StoryObj = {
  name: '⋯ menu',
  render: () => (
    <Board title="⋯ menu">
      <Wrap>
        <Cap label="Not running"><RowMenu /></Cap>
        <Cap label="Row hover"><RowMenu hoverRow="rename" /></Cap>
        <Cap label="Running · delete blocked"><RowMenu running={3} /></Cap>
      </Wrap>
    </Board>
  ),
};

/** Anchored to the row's ⋯. Esc or Cancel closes it. */
export const DeleteConfirmation: StoryObj = {
  name: 'Delete confirm',
  render: () => (
    <Board title="Delete confirm">
      <Cap label="Confirm"><DeleteConfirm name="Bear Put Spread" /></Cap>
    </Board>
  ),
};

/** Bottom of the panel, same white surface. */
export const Toasts: StoryObj = {
  render: () => (
    <Board title="Toasts">
      <div className="flex w-[262px] flex-col gap-4">
        <Cap label="After rename"><PanelToast text="Renamed to “Bear Put Spread v2”" onUndo={() => {}} /></Cap>
        <Cap label="After delete"><PanelToast text="Deleted “Bear Put Spread”" /></Cap>
        <Cap label="After duplicate"><PanelToast text="Duplicated as “Bear Put Spread copy”" /></Cap>
        <Cap label="After Trade"><PanelToast text="Live trade started · Bull Call Spread" /></Cap>
      </div>
    </Board>
  ),
};

/** The one Trade popup (top nav Trade, a row's Trade, ⋯ → Trade…). Placeholder until the Trade phase. */
export const TradePopupOpen: StoryObj = {
  name: 'Trade popup',
  render: function Open() {
    useEffect(() => {
      useLibrary.setState({ tradeFor: { id: 's-bcs', name: 'Bull Call Spread' } });
      return () => useLibrary.setState({ tradeFor: null });
    }, []);
    return <TradePopup />;
  },
};
