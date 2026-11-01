import { Toast } from '@/components/ui/Modal';
import { BacktestPage } from '@/features/backtest/BacktestPage';
import { BottomPanel } from '@/features/bottom-bar/BottomPanel';
import { StrategyCanvas } from '@/features/canvas/StrategyCanvas';
import { ContextBar } from '@/features/context-bar/ContextBar';
import { CopilotPanel } from '@/features/copilot/CopilotPanel';
import { ScenarioPanel } from '@/features/scenarios/ScenarioPanel';
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

  return (
    <div className="flex h-full min-w-[1280px] overflow-hidden bg-surface">
      <main className="flex min-w-0 grow flex-col border-r border-border-divider">
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
    </div>
  );
}
