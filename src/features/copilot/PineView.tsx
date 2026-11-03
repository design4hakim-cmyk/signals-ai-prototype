import { useEffect, useRef } from 'react';
import { changedLines, pineFor } from '@/lib/pine';
import { useCanvas } from '@/store/canvas';
import { useCopilot } from '@/store/copilot';
import { useStrategy } from '@/store/strategy';
import { useShallow } from 'zustand/react/shallow';
import { CardAction, Secondary, Spark, StatusIcon } from './parts';

/** Copilot's Pine Script view: sync bar, the code (changed lines marked), Discard / Apply. */
export function PineView() {
  const { entry, exit, codeOnly } = useCanvas(useShallow((s) => ({ entry: s.entry, exit: s.exit, codeOnly: s.codeOnly })));
  const name = useStrategy((s) => s.name) ?? 'Untitled strategy';
  const { pineBase, pineNote, focusLine, discardCode, applyCode, set } = useCopilot();
  const lines = pineFor({ entry, exit }, name, { codeOnly });
  const changed = pineBase ? changedLines(pineBase, lines) : [];
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, [focusLine]);

  return (
    <div className="flex min-h-0 grow flex-col">
      {changed.length ? (
        <div className="flex shrink-0 items-center gap-2 bg-ai-tint px-4 py-2 text-label">
          <Spark />
          <span className="grow">Copilot changed {changed.length} line{changed.length > 1 ? 's' : ''} · {pineNote}</span>
          <Secondary onClick={discardCode}>Undo</Secondary>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2 bg-success-bg px-4 py-2 text-label text-success">
          <StatusIcon kind="done" /> In sync with canvas
        </div>
      )}
      <div className="min-h-0 grow overflow-auto py-2 font-mono text-[12px] leading-[20px]">
        {lines.map((l, i) => {
          const n = i + 1;
          const isChanged = changed.includes(n);
          const isFocus = focusLine === n;
          return (
            <div
              key={n}
              ref={isFocus ? focusRef : undefined}
              onClick={() => set({ focusLine: n })}
              className={`flex cursor-text pr-4 ${isChanged ? 'bg-ai-tint' : ''} ${isFocus ? 'shadow-focus-inset' : ''}`}
            >
              <span className={`w-10 shrink-0 select-none pr-3 text-right ${isChanged ? 'text-ai-text' : 'text-text-subtle'}`}>{n}</span>
              <span className="whitespace-pre text-text-primary">{l || ' '}</span>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-4 py-2.5">
        <Secondary onClick={discardCode}>Discard changes</Secondary>
        <span className="grow" />
        <CardAction onClick={applyCode}>Apply to strategy</CardAction>
      </div>
    </div>
  );
}
