import { BottomPanel } from '@/features/bottom-bar/BottomPanel';
import { StrategyCanvas } from '@/features/canvas/StrategyCanvas';
import { CopilotPanel } from '@/features/copilot/CopilotPanel';
import { ContextBar, TopBar } from './TopBar';

/**
 * Board "01 · Empty state · chart open" (ST-Main).
 * Layout: left = builder (top bar, context bar, canvas, chart), right = Copilot.
 */
export function Workspace() {
  return (
    <div className="flex h-full min-w-[1280px] overflow-hidden bg-surface">
      <main className="flex min-w-0 grow flex-col border-r border-border-divider">
        <TopBar />
        <ContextBar />
        <StrategyCanvas />
        <BottomPanel />
      </main>
      <CopilotPanel />
    </div>
  );
}
