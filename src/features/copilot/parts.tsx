import type { ReactNode } from 'react';

/*
  Copilot atoms (design/copilot/COMPONENTS.md · Atoms).
  Violet only on the ✦ mark. Activity is blue; card actions are outlined blue.
*/

/** ✦ — the 4-point star, Copilot's mark. */
export const Spark = ({ size = 14 }: { size?: 12 | 13 | 14 | 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-ai">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor" />
  </svg>
);

/** Your message. Copilot never speaks in bubbles, only in cards. */
export const UserBubble = ({ children }: { children: ReactNode }) => (
  <div className="ml-auto max-w-[330px] rounded-[12px_12px_4px_12px] bg-surface-selected px-3 py-2.5 text-body">{children}</div>
);

export const ValueChip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-[5px] bg-surface-selected px-[7px] text-label font-medium text-text-primary">{children}</span>
);

export const ContextChip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-6 items-center rounded-pill border border-border-control bg-surface px-[9px] text-hint text-text-secondary hover:border-brand-border">{children}</span>
);

/** Something Copilot decided itself: dashed. Click to change it. */
export const AssumedChip = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    title="Copilot chose this. Click to change."
    // Plex, not mono: 10.5/400 and no letter-spacing, even inside a spaced-out section label
    className="inline-flex h-5 items-center rounded-pill border border-dashed border-border-dashed bg-surface px-2 font-sans text-[10.5px] font-normal tracking-normal text-text-secondary hover:border-brand-border"
  >
    {children}
  </button>
);

export function AnswerOption({ label, hint, suggested, chosen, disabled, onClick }: { label: string; hint?: string; suggested?: boolean; chosen?: boolean; disabled?: boolean; onClick?: () => void }) {
  const look = chosen
    ? 'border-brand bg-menu-current text-brand-text'
    : disabled
      ? 'border-disabled-border bg-disabled-bg text-text-disabled'
      : suggested
        ? 'border-brand bg-surface shadow-[0_0_0_1px_var(--color-brand)] hover:bg-surface-hover active:bg-row-pressed'
        : 'border-border-chip bg-surface hover:border-border-strong hover:bg-surface-hover active:bg-row-pressed';
  return (
    <button
      type="button"
      disabled={disabled || chosen}
      onClick={onClick}
      className={`flex min-h-[38px] w-full items-center gap-2 rounded-control border px-3 py-2 text-left text-chip outline-none focus-visible:shadow-focus-ring disabled:cursor-default ${look}`}
    >
      <span className="flex grow flex-col">
        <span>{label}</span>
        {hint && <span className={`text-label ${chosen ? 'text-brand-text' : 'text-text-tertiary'}`}>{hint}</span>}
      </span>
      {suggested && !chosen && !disabled && <span className="text-[11px] font-medium text-brand">Suggested</span>}
      {chosen && <span aria-hidden="true" className="text-brand">✓</span>}
    </button>
  );
}

/** Sends its text as the next message. */
export const FollowUpChip = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-[30px] rounded-pill border border-border-chip bg-surface px-3 text-label outline-none hover:border-border-strong hover:bg-surface-hover active:bg-row-pressed focus-visible:shadow-focus-ring"
  >
    {children}
  </button>
);

export function StatusIcon({ kind }: { kind: 'done' | 'working' | 'needs' | 'failed' | 'stopped' }) {
  if (kind === 'working') return <span aria-label="Working" className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />;
  if (kind === 'stopped') return <span aria-label="Stopped" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-selected"><span className="size-1.5 rounded-[1px] bg-text-tertiary" /></span>;
  // full class names, written out: Tailwind only generates classes it can find as text
  const map = {
    done: { fill: 'fill-success', label: 'Done', path: 'M7 12.5l3 3 7-7' },
    failed: { fill: 'fill-error', label: 'Failed', path: 'M12 7v6M12 16.5v.5' },
    needs: { fill: 'fill-warn-dot', label: 'Needs you', path: 'M12 9v4.5M12 17.5v.5' },
  }[kind];
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-label={map.label} className="shrink-0">
      {kind === 'needs' ? <path d="M12 2.5L23 21.5H1z" className={map.fill} /> : <circle cx="12" cy="12" r="11" className={map.fill} />}
      <path d={map.path} stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** ▲ 14 entries · ▼ 13 exits; after a change the old count is struck through. */
export function SignalCounts({ entries, exits, beforeEntries }: { entries: number; exits?: number; beforeEntries?: number }) {
  return (
    <span className="flex flex-wrap items-baseline gap-3 text-body font-semibold tabular-nums">
      <span className="text-buy-text">
        ▲ {beforeEntries !== undefined && beforeEntries !== entries && <><s className="font-normal text-text-subtle">{beforeEntries}</s> → </>}
        {entries} {entries === 1 ? 'entry' : 'entries'}
      </span>
      {exits !== undefined && <span className="text-error">▼ {exits} {exits === 1 ? 'exit' : 'exits'}</span>}
    </span>
  );
}

export function DiffMark({ kind }: { kind: 'added' | 'changed' | 'removed' }) {
  const m = { added: ['+', 'bg-buy-tint text-buy-text'], changed: ['~', 'bg-brand-pressed-tint text-brand'], removed: ['−', 'bg-error-bg text-error'] }[kind];
  return (
    <span aria-label={kind[0].toUpperCase() + kind.slice(1)} className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-body font-bold ${m[1]}`}>
      {m[0]}
    </span>
  );
}

export function FitBadge({ kind }: { kind: 'fits' | 'custom' | 'code' }) {
  const m = {
    fits: { text: 'Fits canvas', cls: 'bg-buy-tint text-buy-strong', code: false },
    custom: { text: 'Custom logic', cls: 'bg-warn-tint text-warn-text', code: true },
    code: { text: 'Code only', cls: 'bg-surface-selected text-text-secondary', code: true },
  }[kind];
  return (
    <span className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] px-[7px] text-[11px] font-semibold ${m.cls}`}>
      {m.code && <CodeGlyph />} {m.text}
    </span>
  );
}

/** `</>`: the only thing in the UI set in JetBrains Mono. */
export const CodeGlyph = () => <span aria-hidden="true" className="font-mono text-[11px] font-semibold">&lt;/&gt;</span>;

/** Card actions are outlined blue: the page keeps its one filled-blue button. */
export const CardAction = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-[30px] shrink-0 rounded-chip border border-brand bg-surface px-3 text-body font-medium text-brand outline-none hover:bg-brand-tint active:bg-brand-pressed-tint focus-visible:shadow-focus-ring"
  >
    {children}
  </button>
);

/** Secondary: white with a grey edge. 30px in footers, 28px for Undo. */
export const Secondary = ({ children, onClick, small, disabled, title }: { children: ReactNode; onClick?: () => void; small?: boolean; disabled?: boolean; title?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`${small ? 'h-7' : 'h-[30px]'} shrink-0 rounded-chip border border-border-chip bg-surface px-3 text-body font-medium text-text-primary outline-none hover:bg-surface-hover active:bg-row-pressed focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled`}
  >
    {children}
  </button>
);

/** Tertiary: a blue word, no edge. */
export const Tertiary = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-[30px] shrink-0 rounded-chip border border-transparent px-3 text-body font-medium text-brand outline-none hover:bg-brand-tint focus-visible:shadow-focus-ring"
  >
    {children}
  </button>
);
