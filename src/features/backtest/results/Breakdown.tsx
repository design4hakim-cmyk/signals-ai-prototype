import type { ReactNode } from 'react';
import { fullMonth, kilo, monthInfo, MONTHS, rupees, tone, num, type ResultsView } from '@/lib/backtestData';
import { useResultsView } from '@/store/results';
import { Card, InfoTip, SectionTitle } from './bits';
import { TIPS } from './helpers';

/*
  4 · Year-wise returns — heatmap, three steps by |month| ÷ the biggest month.
  5 · Detailed statistics — all 17 numbers in three groups.
*/

const PROFIT = ['bg-heat-profit-1', 'bg-heat-profit-2', 'bg-heat-profit-3'];
const LOSS = ['bg-heat-loss-1', 'bg-heat-loss-2', 'bg-heat-loss-3'];

export function YearHeatmap({ view }: { view: ResultsView }) {
  const hoverCell = useResultsView((s) => s.hoverCell);
  const set = useResultsView((s) => s.set);
  const biggest = Math.max(1, ...view.yearWise.flatMap((y) => y.months.map((m) => Math.abs(m ?? 0))));
  const step = (v: number) => Math.min(2, Math.floor((Math.abs(v) / biggest) * 3));

  const legend = (
    <span className="flex items-center gap-1.5 text-hint text-text-tertiary">
      Loss
      {[...LOSS].reverse().map((c) => <span key={c} className={`h-2.5 w-3.5 rounded-[3px] ${c}`} />)}
      {PROFIT.map((c) => <span key={c} className={`h-2.5 w-3.5 rounded-[3px] ${c}`} />)}
      Profit
      <span className="ml-2">– no trades</span>
    </span>
  );

  return (
    <Card title="Year-wise returns" right={legend}>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full border-separate border-spacing-x-1 border-spacing-y-1 text-center text-label tabular-nums">
          <thead>
            <tr className="text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary">
              <th className="pr-2 text-left font-semibold">YEAR</th>
              {MONTHS.map((m) => <th key={m} className="font-semibold">{m.toUpperCase()}</th>)}
              <th className="pl-3 text-right font-semibold">TOTAL</th>
              <th className="pl-3 text-right font-semibold">MAX DD</th>
            </tr>
          </thead>
          <tbody>
            {view.yearWise.map((y) => (
              <tr key={y.year}>
                <th className="pr-2 text-left text-body font-semibold">{y.year}</th>
                {y.months.map((v, m) => {
                  const hovered = hoverCell?.year === y.year && hoverCell.month === m;
                  if (v === null)
                    return (
                      <td key={m}>
                        <span className="flex h-[34px] min-w-[52px] items-center justify-center rounded-chip bg-heat-empty text-text-disabled">–</span>
                      </td>
                    );
                  const info = monthInfo(view.trades, y.year, m);
                  return (
                    <td key={m} className="relative">
                      <button
                        type="button"
                        aria-label={`${fullMonth(m)} ${y.year}: ${rupees(v)}, ${info.trades} trades, ${info.winRate}% won`}
                        onMouseEnter={() => set({ hoverCell: { year: y.year, month: m } })}
                        onMouseLeave={() => set({ hoverCell: null })}
                        onFocus={() => set({ hoverCell: { year: y.year, month: m } })}
                        onBlur={() => set({ hoverCell: null })}
                        className={`flex h-[34px] w-full min-w-[52px] items-center justify-center rounded-chip text-label font-semibold outline-none focus-visible:outline-2 focus-visible:outline-brand ${
                          v >= 0 ? `${PROFIT[step(v)]} text-chip-buy-text` : `${LOSS[step(v)]} text-chip-sell-text`
                        } ${hovered ? 'ring-1 ring-text-primary/20' : ''}`}
                      >
                        {kilo(v)}
                      </button>
                      {hovered && <MonthTip label={`${fullMonth(m)} ${y.year}`} value={v} trades={info.trades} winRate={info.winRate} />}
                    </td>
                  );
                })}
                <td className={`pl-3 text-right text-body font-semibold ${tone(y.total)}`}>{rupees(y.total)}</td>
                <td className={`pl-3 text-right text-body font-semibold ${tone(y.maxDrawdown)}`}>{rupees(y.maxDrawdown)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MonthTip({ label, value, trades, winRate }: { label: string; value: number; trades: number; winRate: number }) {
  return (
    <div role="tooltip" className="absolute top-[calc(100%+4px)] left-1/2 z-20 flex w-[150px] -translate-x-1/2 flex-col gap-1 rounded-control border border-border-control bg-surface p-2.5 text-left text-label shadow-surface">
      <b className="font-semibold">{label}</b>
      <span className="flex justify-between"><span className="text-text-secondary">P&L</span><b className={`font-semibold ${tone(value)}`}>{rupees(value, { plus: true })}</b></span>
      <span className="flex justify-between"><span className="text-text-secondary">Trades</span><b className="font-semibold">{trades}</b></span>
      <span className="flex justify-between"><span className="text-text-secondary">Win rate</span><b className="font-semibold">{winRate}%</b></span>
    </div>
  );
}

/* ── Detailed statistics ───────────────────────────────────────── */

function Row({ label, tip, value, cls = 'text-text-primary', under }: { label: string; tip?: string; value: ReactNode; cls?: string; under?: string }) {
  return (
    <div className="flex flex-col border-t border-border-subtle py-2 first:border-t-0">
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-body text-text-secondary">{label}{tip && <InfoTip text={tip} />}</span>
        <b className={`text-body font-semibold tabular-nums ${cls}`}>{value}</b>
      </span>
      {under && <span className="text-hint text-text-muted">{under}</span>}
    </div>
  );
}

export function DetailedStats({ view }: { view: ResultsView }) {
  const s = view.stats;
  const money = (n: number) => rupees(n, { decimals: 2, plus: true });
  return (
    <div className="flex flex-col gap-2.5">
      <SectionTitle title="Detailed statistics" sub="All 17 numbers, grouped" />
      <div className="grid grid-cols-3 items-start gap-3.5">
        <Card title="Profitability">
          <div className="px-4 pb-2">
            <Row label="Overall profit" value={rupees(Math.round(s.profit))} cls={tone(s.profit)} />
            <Row label="Average per trade" value={rupees(s.avg, { decimals: 2 })} cls={tone(s.avg)} />
            <Row label="Average win" value={money(s.avgwin)} cls={tone(s.avgwin)} />
            <Row label="Average loss" value={money(s.avgloss)} cls={tone(s.avgloss)} />
            <Row label="Best trade" value={money(s.maxwin)} cls={tone(s.maxwin)} />
            <Row label="Worst trade" value={money(s.maxloss)} cls={tone(s.maxloss)} />
          </div>
        </Card>
        <Card title="Consistency">
          <div className="px-4 pb-2">
            <div className="flex flex-col gap-1.5 pb-2">
              <div className="flex h-2 overflow-hidden rounded-full bg-sell-tint" aria-hidden="true">
                <span className="bg-pnl-up" style={{ width: `${s.win}%` }} />
                <span className="grow bg-heat-loss-2" />
              </div>
              <span className="flex justify-between text-hint font-medium tabular-nums">
                <span className="text-pnl-up">{s.win.toFixed(2)}% won</span>
                <span className="text-pnl-down">{s.loss.toFixed(2)}% lost</span>
              </span>
            </div>
            <Row label="Trades" value={s.trades} />
            <Row label="Longest win streak" value={`${s.wstreak} trades`} cls="text-pnl-up" />
            <Row label="Longest losing streak" value={`${s.lstreak} trades`} cls="text-pnl-down" />
            <Row label="Reward : Risk" tip={TIPS.rr} value={s.rr.toFixed(2)} />
            <Row label="Expectancy" tip={TIPS.exp} value={num(s.exp)} cls={tone(s.exp)} />
          </div>
        </Card>
        <Card title="Risk">
          <div className="px-4 pb-2">
            <Row label="Max drawdown" value={rupees(s.mdd, { decimals: 2 })} cls={tone(s.mdd)} />
            <Row label="Max drawdown period" value={`${s.mdd_days} days`} under={`${s.mdd_from} → ${s.mdd_to}`} />
            <Row label="Trades inside a drawdown" tip={TIPS.ddTrades} value={`${s.dd_trades} of ${s.trades}`} />
            <Row label="Return / Max DD" tip={TIPS.retDd} value={num(s.ret_dd)} cls={tone(s.ret_dd)} />
          </div>
        </Card>
      </div>
    </div>
  );
}
