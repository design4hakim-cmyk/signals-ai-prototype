import { create } from 'zustand';

/*
  What's being dragged and where it would land (COMPONENTS.md §6, §8).
  `index` is the insert position in `parentId`; the rail draws a blue line there.
  `valid: false` = too deep: the target turns dashed red with the reason, nothing moves.
*/

export interface DropTarget {
  parentId: string;
  index: number;
  valid: boolean;
  reason?: string;
}

export const useDragState = create<{ activeId: string | null; target: DropTarget | null }>(() => ({ activeId: null, target: null }));
