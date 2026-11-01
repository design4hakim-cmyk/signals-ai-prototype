import { useStrategy } from '@/store/strategy';

/*
  The dotted canvas with Entry and Exit columns.
  Empty state for now, plus a STATIC preview of the demo strategy
  (EMA 9 × EMA 21) when a scenario says the strategy has conditions.
  The real drag-and-drop builder comes in the canvas phase.
*/

export function StrategyCanvas() {
  const entry = useStrategy((s) => s.entry);

  return (
    <section aria-label="Strategy canvas" className="bg-canvas-dots relative min-h-0 grow overflow-auto">
      <div className="grid grid-cols-[1.6fr_1fr] gap-8 px-12 pt-8">
        <Column title="Entry" hint="When your strategy should enter a position">
          {entry !== 'empty' && (
            <Blocks
              rows={[
                ['EMA', '(9, Close)', 'Cross Above', 'EMA', '(21, Close)'],
                ['RSI', '(14)', 'Greater Than', '50', ''],
                ...(entry === 'partial' ? [['Volume', '', 'Select relation', '', ''] as Row] : []),
              ]}
              partialLast={entry === 'partial'}
            />
          )}
        </Column>
        <Column title="Exit" hint="When your strategy should exit">
          {entry !== 'empty' && <Blocks rows={[['EMA', '(9, Close)', 'Cross Below', 'EMA', '(21, Close)']]} />}
        </Column>
      </div>

      {entry === 'empty' && (
        <div className="absolute top-[200px] left-1/2 flex w-[420px] -translate-x-1/2 flex-col items-center gap-2 text-center">
          <p className="m-0 text-body-lg font-medium text-text-secondary">Your strategy will appear here</p>
          <p className="m-0 text-chip text-text-muted">
            Describe it to Copilot, press + to add a condition, or open a saved one from My Strategies.
          </p>
        </div>
      )}
    </section>
  );
}

type Row = [string, string, string, string, string];

function Blocks({ rows, partialLast }: { rows: Row[]; partialLast?: boolean }) {
  return (
    <div className="mt-2 flex flex-col gap-3.5 border-l border-line-connector pl-0">
      {rows.map(([a, aArgs, op, b, bArgs], i) => {
        const half = partialLast && i === rows.length - 1;
        return (
          <div key={i} className="flex items-center">
            <span className="h-px w-[22px] shrink-0 bg-line-connector" />
            <div
              className={`inline-flex items-center gap-2.5 rounded-block border bg-surface px-3.5 py-1.5 whitespace-nowrap ${
                half ? 'border-dashed border-warn-dot' : 'border-border-control'
              }`}
            >
              <span className="text-body font-medium">
                {a} <span className="font-normal text-text-subtle">{aArgs}</span>
              </span>
              <span className={`rounded-chip px-2.5 py-1 text-body font-medium ${half ? 'text-warn-text' : 'bg-surface-selected'}`}>{op}</span>
              {b && (
                <span className="text-body font-medium">
                  {b} <span className="font-normal text-text-subtle">{bArgs}</span>
                </span>
              )}
            </div>
            {half && <span className="ml-2 text-label text-warn-text">Condition 3 isn't finished</span>}
          </div>
        );
      })}
    </div>
  );
}

function Column({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div>
      <h2 className="m-0 text-title font-semibold">{title}</h2>
      <p className="m-0 mt-1 text-label text-text-muted">{hint}</p>
      <div className="mt-[30px] flex w-4 flex-col items-center">
        <span className="size-3 rounded-full border border-line-node bg-surface" />
        <span className="h-5 w-px bg-line-connector" />
      </div>
      <div className="ml-1.5">{children}</div>
      <div className="mt-3 flex w-4 flex-col items-center">
        <button
          type="button"
          aria-label={`Add ${title.toLowerCase()} condition`}
          className="flex size-[22px] items-center justify-center rounded-full border border-brand bg-surface text-[14px] leading-none text-brand hover:bg-brand-tint"
        >
          +
        </button>
      </div>
    </div>
  );
}
