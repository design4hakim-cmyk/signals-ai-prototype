/** The dotted canvas with Entry and Exit columns. Empty state for now. */
export function StrategyCanvas() {
  return (
    <section aria-label="Strategy canvas" className="bg-canvas-dots relative min-h-0 grow overflow-auto">
      <div className="grid grid-cols-2 gap-8 px-12 pt-8">
        <Column title="Entry" hint="When your strategy should enter a position" />
        <Column title="Exit" hint="When your strategy should exit" />
      </div>

      <div className="absolute top-[200px] left-1/2 flex w-[420px] -translate-x-1/2 flex-col items-center gap-2 text-center">
        <p className="m-0 text-body-lg font-medium text-text-secondary">Your strategy will appear here</p>
        <p className="m-0 text-chip text-text-muted">
          Describe it to Copilot, press + to add a condition, or open a saved one from My Strategies.
        </p>
      </div>
    </section>
  );
}

function Column({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="m-0 text-title font-semibold">{title}</h2>
      <p className="m-0 mt-1 text-label text-text-muted">{hint}</p>
      {/* the rail: start dot, line, + button */}
      <div className="mt-[30px] flex w-4 flex-col items-center">
        <span className="size-3 rounded-full border border-line-node bg-surface" />
        <span className="h-10 w-px bg-line-connector" />
        <button
          type="button"
          aria-label={`Add ${title.toLowerCase()} condition`}
          className="flex size-4 items-center justify-center rounded-full border border-brand-border bg-surface text-label leading-none text-brand hover:bg-brand-tint"
        >
          +
        </button>
      </div>
    </div>
  );
}
