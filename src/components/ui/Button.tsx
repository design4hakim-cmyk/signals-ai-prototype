import type { ButtonHTMLAttributes } from 'react';

/*
  Button: one component, several variants, all from the canvas.
    primary   → blue filled  (.pb)   e.g. Run Backtest
    secondary → white outlined (.sb) e.g. Period 1Y, Save
    dropdown  → small outlined (.dd) e.g. NIFTY, SPOT, 15m
    tab       → secondary that looks "pressed" when selected (Chart / Logs)
*/

type Variant = 'primary' | 'secondary' | 'dropdown' | 'tab';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  selected?: boolean;
}

const base =
  'inline-flex shrink-0 items-center gap-1.5 rounded-control font-sans whitespace-nowrap transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'h-control px-3.5 text-body font-medium bg-brand text-text-on-brand hover:bg-brand-hover ' +
    'disabled:bg-action-disabled disabled:hover:bg-action-disabled',
  secondary:
    'h-control px-3 text-body text-text-control bg-surface border border-border-control hover:bg-surface-hover',
  dropdown:
    'h-control-sm px-2.5 text-label font-medium text-text-control bg-surface border border-border-control hover:bg-surface-hover',
  tab: 'h-control px-3 text-body text-text-control border',
};

export function Button({
  variant = 'secondary',
  selected = false,
  className = '',
  ...rest
}: ButtonProps) {
  const tabState =
    variant === 'tab'
      ? selected
        ? 'bg-surface-selected border-transparent font-semibold'
        : 'bg-surface border-border-control hover:bg-surface-hover'
      : '';
  return (
    <button
      type="button"
      aria-pressed={variant === 'tab' ? selected : undefined}
      className={`${base} ${variants[variant]} ${tabState} ${className}`}
      {...rest}
    />
  );
}

/** Square icon-only button (.ib). Always give it an aria-label. */
export function IconButton({
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) {
  return (
    <button
      type="button"
      title={rest['aria-label']}
      className={
        'flex size-control shrink-0 items-center justify-center rounded-control text-text-secondary ' +
        'hover:bg-surface-selected focus-visible:outline-2 focus-visible:outline-brand ' +
        className
      }
      {...rest}
    />
  );
}
