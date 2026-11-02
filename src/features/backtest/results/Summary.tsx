import { useState } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { Popover } from '@/components/ui/Popover';
import { isoToLabel, num, rupees, tone, type ResultsView, type Trade } from '@/lib/backtestData';
import { useResultsView } from '@/store/results';
import { InfoTip, SecondaryButton } from './bits';
import { TIPS } from './helpers';

/*
  1 · Results header — title, what it covers, the VIX filter, Download report.
  2 · Headline numbers — one card, six cells, coloured by sign.
*/

export function ResultsHeader({ view, allTrades, instrument, periodLabel, onDownload }: { view: ResultsView; allTrades: Trade[]; instrument: string; periodLabel: string; onDownload: () => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grow">
        <h2 className="m-0 text-[18px] font-semibold">Results</h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-text-muted">
          {instrument} · {periodLabel} · {isoToLabel(view.from)} – {isoToLabel(view.to)} · {view.stats.trades} trades
        </p>
      </div>
      <VixFilter allTrades={allTrades} />
      <SecondaryButton onClick={onDownload}>Download report</SecondaryButton>
    </div>
  );
}

/** Was "Select VIX range · Re-calculate". Shows how many trades match before applying; nothing re-runs. */
function VixFilter({ allTrades }: { allTrades: Trade[] }) {
  const { vix, vixOpen, set } = useResultsView();
  const [draft, setDraft] = useState<[string, string]>(() => (vix ? [String(vix[0]), String(vix[1])] : ['12', '20']));
  const lo = Number(draft[0]);
  const hi = Number(draft[1]);
  const valid = draft[0] !== '' && draft[1] !== '' && lo <= hi;
  const matching = valid ? allTrades.filter((t) => t.vix >= lo && t.vix <= hi).length : 0;
  const applied = !!vix;

  return (
    <Popover
      floating
      align="right"
      open={vixOpen}
      onClose={() => set({ vixOpen: false })}
      trigger={
        <button
          type="button"
          aria-expanded={vixOpen}
          onClick={() => set({ vixOpen: !vixOpen })}
          className={`flex h-[30px] items-center gap-1.5 rounded-control border px-2.5 text-label tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            applied ? 'border-brand-border bg-brand-tint text-brand-text' : vixOpen ? 'border-brand bg-surface' : 'border-border-control bg-surface hover:border-border-strong'
          }`}
        >
          <span className={applied ? 'text-brand-text' : 'text-text-tertiary'}>Filter</span>
          <b className="font-semibold">VIX {applied ? `${vix![0]} – ${vix![1]}` : '0 – 150'}</b>
          <ChevronDownIcon size={11} />
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) set({ vix: lo <= 0 && hi >= 150 ? null : [lo, hi], vixOpen: false, page: 1 });
        }}
        className="flex w-[268px] flex-col gap-3 rounded-block border border-border-control bg-surface p-4 shadow-surface"
      >
        <span className="text-body font-semibold">Only count trades when VIX is</span>
        <div className="flex items-center gap-2 text-body text-text-secondary">
          between
          <input autoFocus inputMode="decimal" aria-label="Lowest VIX" value={draft[0]} onChange={(e) => setDraft((d) => [e.target.value, d[1]])} className={`h-8 w-[64px] rounded-chip border px-2 tabular-nums outline-none focus:border-brand ${valid ? 'border-border-chip' : 'border-error bg-error-bg'}`} />
          and
          <input inputMode="decimal" aria-label="Highest VIX" value={draft[1]} onChange={(e) => setDraft((d) => [d[0], e.target.value])} className={`h-8 w-[64px] rounded-chip border px-2 tabular-nums outline-none focus:border-brand ${valid ? 'border-border-chip' : 'border-error bg-error-bg'}`} />
        </div>
        <span className={`text-label ${valid ? 'text-text-tertiary' : 'text-error'}`}>
          {valid ? `${matching} of ${allTrades.length} trades match` : 'The first number must be the lower one'}
        </span>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setDraft(['0', '150']); set({ vix: null, vixOpen: false, page: 1 }); }} className="h-[30px] rounded-control px-3 text-body font-medium text-brand hover:bg-brand-tint">
            Reset
          </button>
          <button type="submit" disabled={!valid || matching === 0} className="h-[30px] rounded-control border border-brand bg-surface px-3 text-body font-medium text-brand hover:bg-brand-tint disabled:border-border-control disabled:text-text-disabled disabled:hover:bg-transparent">
            Apply
          </button>
        </div>
      </form>
    </Popover>
  );
}

interface Cell {
  label: string;
  tip?: string;
  value: string;
  tone: string;
  sub: string;
  /** vs the previous run (shown right after an update) */
  change?: { now: number; before: number };
}

/** ▲ 4.2% / ▼ 1.1% / No change — after an update, against the previous run. */
function ChangePill({ now, before }: { now: number; before: number }) {
  if (now === before) return <span className="text-hint text-text-subtle">No change</span>;
  const pct = ((now - before) / Math.abs(before || 1)) * 100;
  const better = now > before; // all three are "higher is better" (drawdown is negative)
  return (
    <span className={`rounded-[4px] px-1.5 text-hint font-semibold ${better ? 'bg-buy-tint text-pnl-up' : 'bg-sell-tint text-pnl-down'}`}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Headline({ view, previous }: { view: ResultsView; previous?: { netPnl: number; winRate: number; maxDrawdown: number } | null }) {
  const s = view.stats;
  const cells: Cell[] = [
    { label: 'Net P&L', value: rupees(Math.round(s.profit)), tone: tone(s.profit), sub: `${rupees(s.avg, { decimals: 2 })} per trade`, change: previous ? { now: Math.round(s.profit), before: previous.netPnl } : undefined },
    { label: 'Win rate', value: `${s.win.toFixed(1)}%`, tone: 'text-text-primary', sub: `${s.wins} of ${s.trades} trades won`, change: previous ? { now: Math.round(s.win * 10) / 10, before: previous.winRate } : undefined },
    { label: 'Max drawdown', value: rupees(Math.round(s.mdd)), tone: tone(s.mdd), sub: `over ${s.mdd_days} days, peak to bottom`, change: previous ? { now: Math.round(s.mdd), before: previous.maxDrawdown } : undefined },
    { label: 'Return / Max DD', tip: TIPS.retDd, value: num(s.ret_dd), tone: tone(s.ret_dd), sub: 'Above 1 is healthy' },
    { label: 'Reward : Risk', tip: TIPS.rr, value: s.rr.toFixed(2), tone: 'text-text-primary', sub: 'Avg win ÷ avg loss' },
    { label: 'Expectancy', tip: TIPS.exp, value: num(s.exp), tone: tone(s.exp), sub: 'Per ₹1 risked' },
  ];
  return (
    <div className="grid grid-cols-6 gap-px overflow-hidden rounded-card border border-border-divider bg-border-divider">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-1 bg-surface px-4 py-3">
          <span className="flex items-center gap-1 text-label text-text-muted">
            {c.label}
            {c.tip && <InfoTip text={c.tip} />}
          </span>
          <span className="flex flex-wrap items-baseline gap-2">
            <span className={`text-[22px] leading-7 font-semibold tabular-nums ${c.tone}`}>{c.value}</span>
            {c.change && <ChangePill {...c.change} />}
          </span>
          <span className="text-hint text-text-muted">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}

/** Skeleton of the headline row (running state). */
export function HeadlineSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-px overflow-hidden rounded-card border border-border-divider bg-border-divider">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 bg-surface px-4 py-3.5">
          <span className="block h-2.5 w-16 animate-pulse rounded bg-surface-selected" />
          <span className="block h-5 w-24 animate-pulse rounded bg-surface-selected" />
          <span className="block h-2 w-20 animate-pulse rounded bg-surface-hover" />
        </div>
      ))}
    </div>
  );
}
