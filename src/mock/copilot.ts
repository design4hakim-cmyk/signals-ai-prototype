import type { CopilotStarter } from '@/types/market';

// Starter prompts shown in the Copilot empty state (from board ST-Main)
export const copilotStarters: CopilotStarter[] = [
  {
    id: 'sma-cross',
    title: 'Simple Moving Average Crossover',
    description: 'Buy when fast MA crosses above slow MA.',
  },
  {
    id: 'macd-cross',
    title: 'MACD Signal Crossover',
    description: 'Enter on MACD crossover with confirmation.',
  },
  {
    id: 'ma-macd',
    title: 'MA + MACD Confirmation',
    description: 'Enter on MA crossover confirmed by MACD.',
  },
];

export const mockUser = { firstName: 'Hakim' };
