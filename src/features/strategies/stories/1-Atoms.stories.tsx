import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton, IndexIcon, NameInput, RunningChips, SearchField, TradeButton } from '../parts';
import { Board, Tile, Wrap } from './helpers';

/* st-components §1 · Atoms */

const meta: Meta = { title: 'My Strategies/1 Atoms', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};

/** 30×30, radius 7. The instrument's logo when the data has one; otherwise a letter on the symbol's tint. */
export const IndexIcons: StoryObj = {
  render: () => (
    <Board title="Index icon" note="Letter tiles for now; the logo slot takes the instrument's own logo (AlgoTest icon set) when the data has one.">
      <Wrap>
        <Tile label="Logo slot · 30 × 30">
          <span className="flex size-[30px] items-center justify-center rounded-[7px] border border-dashed border-border-strong text-[8px] text-text-subtle">LOGO</span>
        </Tile>
        {['NIFTY', 'SENSEX', 'ETH', 'BTC', 'GROWW', 'ASIANPAINT', 'FINNIFTY'].map((s) => (
          <Tile key={s} label={`${s} · ${s === 'FINNIFTY' ? 'no tint yet' : 'fallback'}`}><IndexIcon symbol={s} /></Tile>
        ))}
      </Wrap>
    </Board>
  ),
};

/** Information only: no hover, no click. Shown only when the count is above 0. */
export const RunningChipStates: StoryObj = {
  name: 'Running chips',
  render: () => (
    <Board title="Running chips" note="FT = forward test; full words on hover.">
      <Wrap>
        <Tile label="Live · 1"><RunningChips live={1} forwardTests={0} /></Tile>
        <Tile label="Live · 2+"><RunningChips live={2} forwardTests={0} /></Tile>
        <Tile label="FT · forward test"><RunningChips live={0} forwardTests={1} /></Tile>
        <Tile label="Both"><RunningChips live={2} forwardTests={1} /></Tile>
        <Tile label="Nothing running · no chip"><span className="text-hint text-text-subtle">(none)</span><RunningChips live={0} forwardTests={0} /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Small (26px), outlined blue: never competes with the page's one filled-blue action. */
export const TradeButtonStates: StoryObj = {
  name: 'Trade button',
  render: () => (
    <Board title="Trade button">
      <Wrap>
        <Tile label="Default"><TradeButton /></Tile>
        <Tile label="Hover"><TradeButton force="hover" /></Tile>
        <Tile label="Pressed"><TradeButton force="pressed" /></Tile>
        <Tile label="Focused"><TradeButton force="focused" /></Tile>
        <Tile label="Disabled · market closed for live"><TradeButton disabled title="Market closed for live" /></Tile>
      </Wrap>
    </Board>
  ),
};

/** ⋯ on rows, pin / close in the header. */
export const IconButtons: StoryObj = {
  render: () => (
    <Board title="Icon buttons">
      <Wrap>
        <Tile label="⋯ · default"><IconButton kind="more" label="More actions" /></Tile>
        <Tile label="⋯ · hover"><IconButton kind="more" label="More actions" force="hover" /></Tile>
        <Tile label="⋯ · pressed"><IconButton kind="more" label="More actions" force="pressed" /></Tile>
        <Tile label="⋯ · focus"><IconButton kind="more" label="More actions" force="focused" /></Tile>
        <Tile label="⋯ · open"><IconButton kind="more" label="More actions" open /></Tile>
        <Tile label="Pin · default"><IconButton kind="pin" label="Pin panel" /></Tile>
        <Tile label="Pin · hover"><IconButton kind="pin" label="Pin panel" force="hover" /></Tile>
        <Tile label="Pin · focus"><IconButton kind="pin" label="Pin panel" force="focused" /></Tile>
        <Tile label="Close (pinned) · default"><IconButton kind="unpin" label="Close panel" /></Tile>
      </Wrap>
    </Board>
  ),
};

export const SearchFieldStates: StoryObj = {
  name: 'Search field',
  render: () => (
    <Board title="Search field" note="A clear × appears once there's text.">
      <Wrap>
        <Tile label="Default" width={262}><SearchField value="" onChange={noop} /></Tile>
        <Tile label="Hover" width={262}><SearchField value="" onChange={noop} force="hover" /></Tile>
        <Tile label="Focused" width={262}><SearchField value="" onChange={noop} force="focused" /></Tile>
        <Tile label="Typing · clear button" width={262}><SearchField value="rsi" onChange={noop} force="focused" /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Same field rules as the rest of the product. */
export const NameFieldStates: StoryObj = {
  name: 'Name field (rename)',
  render: () => (
    <Board title="Name field (rename)">
      <Wrap>
        <Tile label="Editing" width={230}><NameInput value="Bear Put Spread" autoFocus={false} /></Tile>
        <Tile label="Duplicate name" width={230}><NameInput value="Iron Condor" error="A NIFTY strategy already has this name" autoFocus={false} /></Tile>
        <Tile label="Empty" width={230}><NameInput value="" error="Name can't be empty" autoFocus={false} /></Tile>
      </Wrap>
    </Board>
  ),
};
