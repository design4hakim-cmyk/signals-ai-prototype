import { useEffect, useRef } from 'react';
import { fmtDate, fmtHeld, fmtPrice, fmtSigned, fmtTime } from '@/lib/signals';
import { useAppliedChart } from './useSignals';

/*
  Signal log (K12 state 9). Each row is one trade: entry and exit side by side.
  Open trades say they're waiting for an exit. Newest at the bottom (scrolled into view).
*/

const ENTRY_SIGNAL = 'EMA 9 cross above 21';
const EXIT_SIGNAL = 'EMA 9 cross below 21';

export function SignalLog() {
  const { signals, applied } = useAppliedChart();
  const scroller = useRef<HTMLDivElement>(null);
  const trades = signals?.trades ?? [];
  const open = trades.filter((t) => t.exitTime === null).length;
  const rows = trades.slice(-200);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [signals]);

  const exportCsv = () => {
    const lines = ['entry_time,entry_price,exit_time,exit_price,points'];
    for (const t of trades) {
      const pts = t.exitPrice !== null ? (t.exitPrice - t.entryPrice).toFixed(2) : '';
      lines.push(
        [new Date(t.entryTime * 1000).toISOString(), t.entryPrice.toFixed(2), t.exitTime ? new Date(t.exitTime * 1000).toISOString() : '', t.exitPrice?.toFixed(2) ?? '', pts].join(','),
      );
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'signal-log.csv';
    a.click();
  };

  if (!signals) {
    return <div className="flex h-full items-center justify-center text-chip text-text-muted">No signals yet. Add an entry condition to see them here.</div>;
  }

  return (
    <div className="flex h-full flex-col pb-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-label text-text-tertiary">
          {trades.length} trades · {open} open · {applied.instrument} {applied.chartData.kind === 'spot' ? 'Spot' : ''} {applied.timeframe} · {applied.period}
        </span>
        <button type="button" onClick={exportCsv} className="h-7 rounded-segment-item border border-border-control bg-surface px-2.5 text-label font-medium hover:bg-surface-hover">
          Export CSV
        </button>
      </div>
      <div ref={scroller} className="min-h-0 grow overflow-auto rounded-control border border-border-subtle">
        <table className="w-full border-collapse text-label">
          <thead className="sticky top-0 z-10 text-left text-[11px] text-text-tertiary [&_th]:bg-surface">
            <tr>
              <th colSpan={3} className="border-b border-border-subtle px-3 pt-2 font-semibold text-buy-text">ENTRY</th>
              <th colSpan={3} className="border-b border-l border-border-subtle px-3 pt-2 font-semibold text-sell-text">EXIT</th>
              <th colSpan={2} className="border-b border-l border-border-subtle px-3 pt-2 font-semibold">RESULT</th>
            </tr>
            <tr className="font-normal">
              {['Time', 'Price', 'Signal', 'Time', 'Price', 'Signal', 'Points', 'Held'].map((h, i) => (
                <th key={i} className={`border-b border-border-subtle px-3 py-1.5 font-medium ${i === 3 || i === 6 ? 'border-l' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const pts = t.exitPrice !== null ? t.exitPrice - t.entryPrice : null;
              return (
                <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover">
                  <Cell time={t.entryTime} />
                  <td className="px-3 py-2 tabular-nums">{fmtPrice(t.entryPrice)}</td>
                  <td className="px-3 py-2 text-text-tertiary">{ENTRY_SIGNAL}</td>
                  {t.exitTime !== null ? (
                    <>
                      <Cell time={t.exitTime} sameDay={fmtDate(t.exitTime) === fmtDate(t.entryTime)} border />
                      <td className="px-3 py-2 tabular-nums">{fmtPrice(t.exitPrice!)}</td>
                      <td className="px-3 py-2 text-text-tertiary">{EXIT_SIGNAL}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="border-l border-border-subtle px-3 py-2">
                      <b className="font-semibold">Open</b> <span className="text-text-tertiary">· Waiting for exit signal</span>
                    </td>
                  )}
                  <td className={`border-l border-border-subtle px-3 py-2 font-semibold tabular-nums ${pts === null ? 'text-text-subtle' : pts >= 0 ? 'text-pnl-up' : 'text-pnl-down'}`}>
                    {pts === null ? '—' : fmtSigned(pts)}
                  </td>
                  <td className="px-3 py-2 text-text-tertiary">{t.exitTime !== null ? fmtHeld(t.exitTime - t.entryTime) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ time, sameDay, border }: { time: number; sameDay?: boolean; border?: boolean }) {
  return (
    <td className={`px-3 py-2 ${border ? 'border-l border-border-subtle' : ''}`}>
      <span className="block font-medium tabular-nums">{fmtTime(time)}</span>
      {!sameDay && <span className="block text-[11px] text-text-subtle">{fmtDate(time)}</span>}
    </td>
  );
}
