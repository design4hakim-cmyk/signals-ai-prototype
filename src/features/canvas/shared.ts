import { createContext } from 'react';
import type { Logic } from '@/types/strategy';
import type { LogicWord } from './kit/data';

/** Store logic ↔ the words on the canvas. */
export const WORD: Record<Logic, LogicWord> = { AND: 'All of', OR: 'Any of', NONE: 'None of' };
export const LOGIC_OF: Record<LogicWord, Logic> = { 'All of': 'AND', 'Any of': 'OR', 'None of': 'NONE' };

/** Ids of conditions that differ from what the chart was last drawn with (the blue dot). */
export const ChangedContext = createContext<Set<string>>(new Set());
