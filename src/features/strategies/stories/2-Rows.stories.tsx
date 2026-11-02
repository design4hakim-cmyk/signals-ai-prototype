import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton, NameInput, TradeButton } from '../parts';
import { IndexCard, IndexRow, StrategyRow } from '../rows';
import { Board, Tile, Wrap } from './helpers';

/* st-components §2 · Strategy row (content + states) and Index row */

const meta: Meta = { title: 'My Strategies/2 Rows', parameters: { layout: 'fullscreen' } };
export default meta;

const W = 278;
const actions = (open = false, tradeHover = false) => (
  <>
    <TradeButton force={tradeHover ? 'hover' : undefined} />
    <IconButton kind="more" label="More actions" open={open} />
  </>
);

/** Not running: name only. Running: name + counts. Long names wrap to 2 lines, then "…" with the full name on hover. */
export const StrategyRowContent: StoryObj = {
  name: 'Strategy row · content',
  render: () => (
    <Board title="Strategy row · content">
      <Wrap>
        <Tile label="Not running" width={W}><StrategyRow id="a" name="Bear Put Spread" live={0} forwardTests={0} /></Tile>
        <Tile label="Forward test" width={W}><StrategyRow id="b" name="Iron Condor" live={0} forwardTests={1} /></Tile>
        <Tile label="Live" width={W}><StrategyRow id="c" name="RSI Dip & Breakout" live={1} forwardTests={0} /></Tile>
        <Tile label="Live + forward test" width={W}><StrategyRow id="d" name="Bull Call Spread" live={2} forwardTests={1} /></Tile>
        <Tile label="Long name · 2 lines" width={W}><StrategyRow id="e" name="Nifty weekly short strangle with VWAP filter and RSI exit" live={0} forwardTests={0} /></Tile>
        <Tile label="Longer · “…” + full name on hover" width={W}><StrategyRow id="f" name="Nifty weekly short strangle with VWAP filter, RSI exit and time-based stop loss after 2 PM" live={0} forwardTests={1} /></Tile>
      </Wrap>
    </Board>
  ),
};

/** Hover and focus show Trade and ⋯. The strategy open in the builder is tinted blue. */
export const StrategyRowStates: StoryObj = {
  name: 'Strategy row · states',
  render: () => (
    <Board title="Strategy row · states">
      <Wrap>
        <Tile label="Default" width={W}><StrategyRow id="1" name="Bear Put Spread" live={0} forwardTests={0} actions={actions()} /></Tile>
        <Tile label="Hover" width={W}><StrategyRow id="2" name="Bear Put Spread" live={0} forwardTests={0} force="hover" actions={actions()} /></Tile>
        <Tile label="Pressed" width={W}><StrategyRow id="3" name="Bear Put Spread" live={0} forwardTests={0} force="pressed" actions={actions()} /></Tile>
        <Tile label="Focused (keyboard)" width={W}><StrategyRow id="4" name="Bear Put Spread" live={0} forwardTests={0} force="focused" actions={actions()} /></Tile>
        <Tile label="Hover on Trade" width={W}><StrategyRow id="5" name="Bear Put Spread" live={0} forwardTests={0} force="hover" actions={actions(false, true)} /></Tile>
        <Tile label="Open in builder" width={W}><StrategyRow id="6" name="Bull Call Spread" live={2} forwardTests={1} open actions={actions()} /></Tile>
        <Tile label="Open + hover" width={W}><StrategyRow id="7" name="Bull Call Spread" live={2} forwardTests={1} open force="hover" actions={actions()} /></Tile>
        <Tile label="Open · unsaved changes" width={W}><StrategyRow id="8" name="Bull Call Spread" live={2} forwardTests={1} open unsaved actions={actions()} /></Tile>
        <Tile label="⋯ open" width={W}><StrategyRow id="9" name="Bear Put Spread" live={0} forwardTests={0} menuOpen actions={actions(true)} /></Tile>
        <Tile label="Renaming" width={W}>
          <StrategyRow id="10" name="Bear Put Spread" live={0} forwardTests={0} renameSlot={<NameInput value="Bear Put Spread" autoFocus={false} />} />
        </Tile>
        <Tile label="Rename error" width={W}>
          <StrategyRow id="11" name="Iron Condor" live={0} forwardTests={0} renameSlot={<NameInput value="Iron Condor" error="A NIFTY strategy already has this name" autoFocus={false} />} />
        </Tile>
      </Wrap>
    </Board>
  ),
};

/** Collapsed rows are unchanged. Expanded is a soft tinted card, strategies last edited first. */
export const IndexRowStates: StoryObj = {
  name: 'Index row',
  render: () => (
    <Board title="Index row">
      <Wrap>
        <Tile label="Collapsed" width={W}><IndexRow symbol="NIFTY" count={4} /></Tile>
        <Tile label="Hover" width={W}><IndexRow symbol="NIFTY" count={4} force="hover" /></Tile>
        <Tile label="Pressed" width={W}><IndexRow symbol="NIFTY" count={4} force="pressed" /></Tile>
        <Tile label="Focused" width={W}><IndexRow symbol="NIFTY" count={4} force="focused" /></Tile>
        <Tile label="Singular count" width={W}><IndexRow symbol="GROWW" count={1} /></Tile>
        <Tile label="Expanded" width={W}>
          <IndexCard header={<IndexRow symbol="SENSEX" count={3} expanded />}>
            <StrategyRow id="x1" name="Iron Condor" live={0} forwardTests={1} inCard />
            <StrategyRow id="x2" name="Bear Put Spread" live={0} forwardTests={0} inCard />
            <StrategyRow id="x3" name="Bull Call Spread" live={2} forwardTests={1} inCard />
          </IndexCard>
        </Tile>
      </Wrap>
    </Board>
  ),
};
