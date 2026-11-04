import { useEffect } from 'react';
import { useBacktest } from '@/store/backtest';
import { unrunLines, usePine } from '@/store/pine';
import { SetupBlock } from './SetupBlock';

/*
  Backtest tab. Everything about trade setups lives in one stacked block.
  A first-time user lands on a blank "New Trade" setup with the form open.
*/

export function BacktestPage() {
  const count = useBacktest((s) => s.setups.length);
  const addBlank = useBacktest((s) => s.addBlank);

  useEffect(() => {
    if (count === 0) addBlank();
  }, [count, addBlank]);

  const unrun = usePine((p) => unrunLines(p));
  return (
    <section aria-label="Backtest" className="min-h-0 grow overflow-auto bg-surface-canvas p-6">
      {/* the backtest runs on the last code that ran (design/pine-editor §6) */}
      {unrun > 0 && (
        <p className="m-0 mb-3 flex items-center gap-2 text-label text-text-secondary">
          <span className="size-1.5 rounded-full bg-brand" />
          Code has {unrun > 1 ? `${unrun} lines that haven’t` : '1 line that hasn’t'} run. The backtest uses the last code that ran.
        </p>
      )}
      <SetupBlock />
    </section>
  );
}
