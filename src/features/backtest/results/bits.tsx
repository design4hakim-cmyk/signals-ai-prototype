import type { ReactNode } from 'react';

/* Small shared parts of the results page. */

export function Card({ title, sub, right, children, className = '' }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-card border border-border-divider bg-surface ${className}`}>
      {(title || right) && (
        <header className="flex min-h-[46px] flex-wrap items-center gap-x-2.5 gap-y-1 px-4 pt-3 pb-2">
          {title && <h3 className="m-0 text-body-lg font-semibold">{title}</h3>}
          {sub && <span className="text-label text-text-tertiary">{sub}</span>}
          <span className="grow" />
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** ⓘ with a one-sentence tooltip (hover or keyboard focus). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="flex size-[14px] items-center justify-center rounded-full border border-border-radio text-[9px] leading-none font-semibold text-text-tertiary hover:border-text-tertiary focus-visible:outline-2 focus-visible:outline-brand"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden w-max max-w-[220px] -translate-x-1/2 rounded-chip bg-text-primary px-2.5 py-1.5 text-hint font-normal text-text-on-brand shadow-popover group-hover/tip:block group-focus-within/tip:block"
      >
        {text}
      </span>
    </span>
  );
}

export const Bone = ({ className = '' }: { className?: string }) => <span className={`block animate-pulse rounded-chip bg-surface-selected ${className}`} />;

/** Section title between cards, e.g. "Detailed statistics · All 17 numbers, grouped". */
export const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex items-baseline gap-2.5 pt-1">
    <h3 className="m-0 text-body-lg font-semibold">{title}</h3>
    {sub && <span className="text-label text-text-tertiary">{sub}</span>}
  </div>
);

export const SecondaryButton = ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="h-[30px] shrink-0 rounded-control border border-border-chip bg-surface px-3 text-body hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
  >
    {children}
  </button>
);

export const OutlinedBlueButton = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-[30px] shrink-0 rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
  >
    {children}
  </button>
);
