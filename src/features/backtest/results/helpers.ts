import { isoToLabel, rupees, type ResultsView, type Trade } from '@/lib/backtestData';

/** The ⓘ copy: one plain sentence each. */
export const TIPS = {
  retDd: 'Net profit divided by max drawdown. Above 1 is healthy.',
  rr: 'Average win divided by average loss.',
  exp: 'Average return per rupee risked on each trade.',
  ddTrades: 'Trades taken while the account was below its previous high.',
  monteCarlo: 'How deep the drawdown could get if the same trades came in a different order.',
  inOut: 'A curve-fitting check.',
};

function save(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTrades(setupName: string, trades: Trade[]) {
  save(`${setupName} trades.csv`, [
    ['#', 'Date', 'Entry', 'Exit', 'VIX', 'P&L', 'Legs'],
    ...trades.map((t) => [t.n, t.date, t.entry, t.exit, t.vix, t.pnl, t.legs.map((l) => `${l.side} ${l.type} ${l.strike} × ${l.qty}`).join(' + ')]),
  ]);
}

export function downloadReport(setupName: string, v: ResultsView) {
  const s = v.stats;
  save(`${setupName} report.csv`, [
    ['Backtest report', setupName],
    ['Period', `${isoToLabel(v.from)} – ${isoToLabel(v.to)}`],
    ['Net P&L', rupees(s.profit)],
    ['Average per trade', rupees(s.avg, { decimals: 2 })],
    ['Win rate', `${s.win.toFixed(2)}%`],
    ['Trades', s.trades],
    ['Average win', rupees(s.avgwin, { decimals: 2 })],
    ['Average loss', rupees(s.avgloss, { decimals: 2 })],
    ['Best trade', rupees(s.maxwin, { decimals: 2 })],
    ['Worst trade', rupees(s.maxloss, { decimals: 2 })],
    ['Max drawdown', rupees(s.mdd, { decimals: 2 })],
    ['Max drawdown period', `${s.mdd_days} days (${s.mdd_from} → ${s.mdd_to})`],
    ['Return / Max DD', s.ret_dd.toFixed(2)],
    ['Reward : Risk', s.rr.toFixed(2)],
    ['Expectancy', s.exp.toFixed(2)],
    ['Longest win streak', s.wstreak],
    ['Longest losing streak', s.lstreak],
    ['Trades inside a drawdown', s.dd_trades],
  ]);
}
