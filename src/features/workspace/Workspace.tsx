import { Toast } from '@/components/ui/Modal';
import { BacktestPage } from '@/features/backtest/BacktestPage';
import { BottomPanel } from '@/features/bottom-bar/BottomPanel';
import { StrategyCanvas } from '@/features/canvas/StrategyCanvas';
import { ContextBar } from '@/features/context-bar/ContextBar';
import { CopilotPanel } from '@/features/copilot/CopilotPanel';
import { ScenarioPanel } from '@/features/scenarios/ScenarioPanel';
import { StrategiesPanel } from '@/features/strategies/StrategiesPanel';
import { TradePopup } from '@/features/trade/TradePopup';
import { useLibrary } from '@/store/library';
import { TopNav } from '@/features/top-nav/TopNav';
import { useStrategy } from '@/store/strategy';

/**
 * The workspace.
 * Top nav spans the builder column; the mode switch (Build / Backtest) swaps the page under it.
 *   Build    → context bar · canvas · bottom bar (chart + signals)
 *   Backtest → setup block
 * Copilot stays on the right in both.
 */
export function Workspace() {
  const mode = useStrategy((s) => s.mode);
  const toast = useStrategy((s) => s.toast);
  const panel = useLibrary((s) => s.mode);

  return (
    <div className="relative flex h-full min-w-[1280px] overflow-hidden bg-surface">
      {/* My Strategies: pinned sits beside the builder; peek floats over it */}
      {panel === 'pinned' && <StrategiesPanel variant="pinned" />}
      {panel === 'peek' && <PeekPanel />}
      {/* @container: the top nav shortens its labels by the builder's own width (e.g. when My Strategies is pinned) */}
      <main className="@container flex min-w-0 grow flex-col border-r border-border-divider">
        <TopNav />
        {mode === 'build' ? (
          <>
            <ContextBar />
            <StrategyCanvas />
            <BottomPanel />
          </>
        ) : (
          <BacktestPage />
        )}
      </main>
      <CopilotPanel />
      <ScenarioPanel />
      <Toast text={toast} />
      <TradePopup />
    </div>
  );
}

let peekTimer: ReturnType<typeof setTimeout> | undefined;

/** Peek: floats over the builder; closes a moment after the pointer leaves (not while a menu or rename is open). */
function PeekPanel() {
  const busy = () => {
    const s = useLibrary.getState();
    return !!(s.menuId || s.confirmDeleteId || s.renamingId || s.tradeFor);
  };
  return (
    <div
      className="absolute top-0 bottom-0 left-0 z-40"
      onMouseEnter={() => clearTimeout(peekTimer)}
      onMouseLeave={() => {
        peekTimer = setTimeout(() => !busy() && useLibrary.getState().mode === 'peek' && useLibrary.getState().setMode('closed'), 350);
      }}
    >
      <StrategiesPanel variant="peek" />
    </div>
  );
}
