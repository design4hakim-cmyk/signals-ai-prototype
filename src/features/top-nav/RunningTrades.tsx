import { useState } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { useStrategy, type RunningTrade } from '@/store/strategy';

/*
  Running trades: count chips before Trade. Hidden until the strategy has run.
  Click a chip → list anchored under it, right-aligned.
  Each row: setup, broker (live), today's P&L, status.
*/

export function RunningTrades() {
  const fwd = useStrategy((s) => s.forwardTests);
  const live = useStrategy((s) => s.liveTrades);
  if (!fwd.length && !live.length) return null;
  return (
    <div className="flex items-center gap-2.5">
      {fwd.length > 0 && <Chip kind="forward" trades={fwd} />}
      {live.length > 0 && <Chip kind="live" trades={live} />}
    </div>
  );
}

function Chip({ kind, trades }: { kind: 'forward' | 'live'; trades: RunningTrade[] }) {
  const [open, setOpen] = useState(false);
  const showToast = useStrategy((s) => s.showToast);
  const label =
    kind === 'forward'
      ? `${trades.length} Forward test${trades.length > 1 ? 's' : ''}`
      : `${trades.length} Live`;

  return (
    <Popover
      open={open}
      align="right"
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-[30px] shrink-0 items-center gap-1.5 rounded-segment-item border pr-2 pl-2.5 text-[12.5px] font-semibold ${
            kind === 'forward'
              ? 'border-forward-border bg-forward-bg text-forward-text'
              : 'border-live-border bg-live-bg text-live-text'
          }`}
        >
          {kind === 'live' && <span className="size-[7px] rounded-full bg-buy" />}
          {/* short form when the builder is narrow, e.g. with My Strategies pinned */}
          <span className="@max-[980px]:hidden">{label}</span>
          <span className="hidden @max-[980px]:inline">{kind === 'forward' ? `${trades.length} FT` : label}</span>
          <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <ChevronDownIcon size={11} />
          </span>
        </button>
      }
    >
      {/* right-aligned under the chip */}
      <div
        role="menu"
        aria-label={kind === 'forward' ? 'Forward tests' : 'Live trades'}
        className="w-[320px] rounded-block border border-border-control bg-surface p-1.5 shadow-popover"
      >
        <span className="block px-2.5 pt-1.5 pb-2 text-[11px] font-semibold text-text-tertiary">
          {kind === 'forward' ? 'FORWARD TESTS' : 'LIVE TRADES'} · {trades.length}
        </span>
        {trades.map((t) => (
          <button
            key={t.id}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              showToast(`Opens the ${t.setup} trade page (Trade phase)`);
            }}
            className="flex w-full items-center justify-between gap-2.5 rounded-segment-item px-2.5 py-[9px] text-left hover:bg-row-hover"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-text-primary">{t.setup}</span>
              {t.broker && <span className="text-hint text-text-tertiary">{t.broker}</span>}
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className={`text-[12.5px] font-semibold ${t.pnl >= 0 ? 'text-pnl-up' : 'text-pnl-down'}`}>
                {t.pnl >= 0 ? '+' : '−'}₹{Math.abs(t.pnl).toLocaleString('en-IN')}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                <span className={`size-1.5 rounded-full ${t.status === 'Running' ? 'bg-buy' : 'bg-warn-dot'}`} />
                {t.status} · today
              </span>
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
