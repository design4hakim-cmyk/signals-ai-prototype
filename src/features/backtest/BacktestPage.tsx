import { useEffect } from 'react';
import { useBacktest } from '@/store/backtest';
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

  return (
    <section aria-label="Backtest" className="min-h-0 grow overflow-auto bg-surface-canvas p-6">
      <SetupBlock />
    </section>
  );
}
