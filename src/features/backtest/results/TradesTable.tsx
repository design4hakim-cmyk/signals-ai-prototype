import { Fragment } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { rupees, tone, type Trade } from '@/lib/backtestData';
import { useResultsView, type SortKey } from '@/store/results';
import { Card, SecondaryButton } from './bits';

/*
  7 · Trades — one line per trade; click to open its legs underneath.
  Sort (Date / P&L / VIX), 10 per page.
*/

const PER_PAGE = 10;
const KEY_LABEL: Record<SortKey, string> = { date: 'Date', pnl: 'P&L', vix: 'VIX' };
const dirLabel = (key: SortKey, dir: 'asc' | 'desc') =>
  key === 'date' ? (dir === 'asc' ? 'oldest first' : 'newest first') : dir === 'asc' ? 'lowest first' : 'highest first';

export function TradesTable({ trades, onDownload }: { trades: Trade[]; onDownload: () => void }) {
  const { sort, sortOpen, page, expanded, set, toggleTrade } = useResultsView();
  const sorted = [...trades].sort((a, b) => {
    const v = sort.key === 'date' ? a.n - b.n : sort.key === 'pnl' ? a.pnl - b.pnl : a.vix - b.vix;
    return sort.dir === 'asc' ? v : -v;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const rows = sorted.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const go = (p: number) => set({ page: Math.max(1, Math.min(pages, p)) });

  const sortChip = (
    <Popover
      floating
      align="right"
      open={sortOpen}
      onClose={() => set({ sortOpen: false })}
      trigger={
        <button
          type="button"
          aria-expanded={sortOpen}
          onClick={() => set({ sortOpen: !sortOpen })}
          className={`flex h-[30px] items-center gap-1.5 rounded-control border bg-surface px-2.5 text-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${sortOpen ? 'border-brand' : 'border-border-control hover:border-border-strong'}`}
        >
          <span className="text-text-tertiary">Sort</span>
          <b className="font-semibold">{KEY_LABEL[sort.key]} · {dirLabel(sort.key, sort.dir)}</b>
          <ChevronDownIcon size={11} />
        </button>
      }
    >
      <div role="menu" className="flex w-[190px] flex-col rounded-block border border-border-control bg-surface p-1 shadow-surface">
        {(['date', 'pnl', 'vix'] as SortKey[]).map((k) => (
          <MenuRow key={k} current={sort.key === k} onClick={() => set({ sort: { ...sort, key: k }, page: 1 })}>{KEY_LABEL[k]}</MenuRow>
        ))}
        <div className="mx-1 my-1 h-px bg-border-subtle" />
        {(['asc', 'desc'] as const).map((d) => (
          <MenuRow key={d} current={sort.dir === d} onClick={() => set({ sort: { ...sort, dir: d }, page: 1, sortOpen: false })}>
            {dirLabel(sort.key, d)[0].toUpperCase() + dirLabel(sort.key, d).slice(1)}
          </MenuRow>
        ))}
      </div>
    </Popover>
  );

  return (
    <Card
      title="Trades"
      sub={`${trades.length} trades · click a trade to see its legs`}
      right={
        <span className="flex items-center gap-2">
          {sortChip}
          <SecondaryButton onClick={onDownload}>Download trades</SecondaryButton>
        </span>
      }
    >
      <div className="px-4">
        <table className="w-full border-collapse overflow-hidden rounded-control text-body tabular-nums">
          <thead>
            <tr className="bg-surface-hover text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary">
              <th className="w-8" />
              <th className="py-2.5 pr-3 text-left font-semibold">#</th>
              <th className="py-2.5 pr-3 text-left font-semibold">DATE</th>
              <th className="py-2.5 pr-3 text-left font-semibold">ENTRY</th>
              <th className="py-2.5 pr-3 text-left font-semibold">EXIT</th>
              <th className="py-2.5 pr-3 text-left font-semibold">LEGS</th>
              <th className="py-2.5 pr-3 text-right font-semibold">VIX</th>
              <th className="py-2.5 pr-3 text-right font-semibold">P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const open = expanded.includes(t.n);
              return (
                <Fragment key={t.n}>
                  <tr
                    onClick={() => toggleTrade(t.n)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleTrade(t.n))}
                    tabIndex={0}
                    aria-expanded={open}
                    className="cursor-pointer border-t border-border-subtle outline-none hover:bg-surface-selected focus-visible:bg-surface-selected"
                  >
                    <td className="py-2.5 pl-2 text-text-tertiary">
                      <span className={`inline-flex transition-transform ${open ? '' : '-rotate-90'}`}><ChevronDownIcon size={11} /></span>
                    </td>
                    <td className="py-2.5 pr-3 text-text-tertiary">{t.n}</td>
                    <td className="py-2.5 pr-3">{t.date}</td>
                    <td className="py-2.5 pr-3">{t.entry}</td>
                    <td className="py-2.5 pr-3">{t.exit}</td>
                    <td className="py-2.5 pr-3 text-text-secondary">{t.legs.length} legs · Short straddle</td>
                    <td className="py-2.5 pr-3 text-right text-text-secondary">{t.vix.toFixed(2)}</td>
                    <td className={`py-2.5 pr-3 text-right font-semibold ${tone(t.pnl)}`}>{rupees(t.pnl, { decimals: 2, plus: true })}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td />
                      <td colSpan={7} className="pr-3 pb-3">
                        <Legs trade={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between gap-3 px-4 py-3 text-label text-text-tertiary">
        <span>
          Showing {(cur - 1) * PER_PAGE + 1}–{Math.min(cur * PER_PAGE, sorted.length)} of {sorted.length} trades
        </span>
        <nav aria-label="Pages" className="flex items-center gap-0.5 tabular-nums">
          <PageButton disabled={cur === 1} onClick={() => go(cur - 1)}>‹ Prev</PageButton>
          {pageList(cur, pages).map((p, i) =>
            p === '…' ? <span key={`gap-${i}`} className="px-1.5 text-text-subtle">…</span> : (
              <PageButton key={p} current={p === cur} onClick={() => go(p)}>{p}</PageButton>
            ),
          )}
          <PageButton disabled={cur === pages} onClick={() => go(cur + 1)}>Next ›</PageButton>
        </nav>
      </footer>
    </Card>
  );
}

/** 1 2 3 4 5 … 25, keeping the current page and its neighbours visible. */
function pageList(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, 4, 5, cur - 1, cur, cur + 1, total].filter((p) => p >= 1 && p <= total));
  const list = [...set].sort((a, b) => a - b);
  return list.flatMap((p, i) => (i && p - list[i - 1] > 1 ? ['…' as const, p] : [p]));
}

function PageButton({ children, current, disabled, onClick }: { children: React.ReactNode; current?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      className={`h-7 min-w-7 rounded-chip px-2 text-label disabled:cursor-not-allowed disabled:text-text-disabled ${current ? 'bg-menu-current font-semibold text-brand-text' : 'text-text-secondary hover:bg-surface-selected'}`}
    >
      {children}
    </button>
  );
}

function MenuRow({ children, current, onClick }: { children: React.ReactNode; current: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={current} onClick={onClick} className={`flex h-8 items-center justify-between rounded-chip px-2.5 text-left text-body ${current ? 'bg-menu-current text-brand-text' : 'hover:bg-surface-selected'}`}>
      {children}
      {current && <span aria-hidden="true">✓</span>}
    </button>
  );
}

function Legs({ trade }: { trade: Trade }) {
  return (
    <table className="w-full border-collapse rounded-control border border-border-subtle text-label tabular-nums">
      <thead>
        <tr className="text-[10px] font-semibold tracking-[0.06em] text-text-tertiary">
          {['TYPE', 'STRIKE', 'SIDE', 'QTY', 'ENTRY ₹', 'EXIT ₹', 'EXIT TIME'].map((h) => <th key={h} className="px-3 pt-2 pb-1 text-left font-semibold">{h}</th>)}
          <th className="px-3 pt-2 pb-1 text-right font-semibold">P&L</th>
        </tr>
      </thead>
      <tbody>
        {trade.legs.map((l, i) => (
          <tr key={i} className="border-t border-border-subtle">
            <td className="px-3 py-1.5"><span className="rounded-[4px] bg-chip-neutral px-1.5 py-0.5 text-[10.5px] font-semibold text-text-secondary">{l.type}</span></td>
            <td className="px-3 py-1.5">{l.strike}</td>
            <td className="px-3 py-1.5">
              <span className={`rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold ${l.side === 'Sell' ? 'bg-chip-sell-bg text-chip-sell-text' : 'bg-chip-buy-bg text-chip-buy-text'}`}>{l.side.toUpperCase()}</span>
            </td>
            <td className="px-3 py-1.5">{l.qty}</td>
            <td className="px-3 py-1.5">{l.entryPrice.toFixed(2)}</td>
            <td className="px-3 py-1.5">{l.exitPrice.toFixed(2)}</td>
            <td className="px-3 py-1.5">{l.exitTime}</td>
            <td className={`px-3 py-1.5 text-right font-semibold ${tone(l.pnl)}`}>{rupees(l.pnl, { decimals: 2, plus: true })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
