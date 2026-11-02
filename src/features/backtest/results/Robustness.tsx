import { useRef } from 'react';
import { atConfidence, IN_OUT, inOutSample, monteCarlo, MONTE_CARLO, num, rupees, sampleVerdict, tone, type ResultsView, type SampleRow } from '@/lib/backtestData';
import { useResultsView } from '@/store/results';
import { Card, InfoTip, SecondaryButton, SectionTitle } from './bits';
import { TIPS } from './helpers';

/*
  6 · Robustness — "Is this result luck or curve-fitting?"
    Monte Carlo: reshuffle the trades 10,000 times; idle → running → result (says what to do).
    In-sample vs out-of-sample: split the period; does the second part hold up?
*/

export function Robustness({ view }: { view: ResultsView }) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionTitle title="Robustness" sub="Is this result luck or curve-fitting?" />
      <div className="grid grid-cols-2 items-start gap-3.5">
        <MonteCarloCard view={view} />
        <InOutSampleCard view={view} />
      </div>
    </div>
  );
}

function MonteCarloCard({ view }: { view: ResultsView }) {
  const { mc, confidence, set } = useResultsView();
  const sims = MONTE_CARLO.simulations;
  const cancel = useRef({ cancelled: false });

  const run = async () => {
    cancel.current.cancelled = true;
    const token = { cancelled: false };
    cancel.current = token;
    set({ mc: { phase: 'running', done: 0 } });
    const sorted = await monteCarlo(view.trades, sims, (done) => !token.cancelled && set({ mc: { phase: 'running', done } }), token);
    if (sorted) set({ mc: { phase: 'result', sorted } });
  };

  return (
    <Card title="Monte Carlo drawdown" right={<InfoTip text={TIPS.monteCarlo} />}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="m-0 text-label text-text-secondary">
          Reshuffles the order of your {view.stats.trades} trades {sims.toLocaleString('en-IN')} times to see how deep the drawdown could get by luck alone.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-label">
            <span className="text-text-secondary">Confidence</span>
            <b className="font-semibold tabular-nums">{confidence}%</b>
          </span>
          <input type="range" min={1} max={99} value={confidence} onChange={(e) => set({ confidence: Number(e.target.value) })} className="w-full accent-brand" aria-label="Confidence" />
          <span className="flex justify-between text-[10.5px] text-text-subtle"><span>1</span><span>99</span></span>
        </label>

        {mc.phase === 'running' && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-selected">
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(mc.done / sims) * 100}%` }} />
            </div>
            <span className="text-label text-text-tertiary tabular-nums">Simulating… {mc.done.toLocaleString('en-IN')} of {sims.toLocaleString('en-IN')}</span>
          </div>
        )}
        {mc.phase === 'result' && <McResult sorted={mc.sorted} confidence={confidence} backtest={view.stats.mdd} />}

        {mc.phase !== 'running' && (
          <div>
            <SecondaryButton onClick={run}>{mc.phase === 'result' ? 'Run again' : `Run ${sims.toLocaleString('en-IN')} simulations`}</SecondaryButton>
          </div>
        )}
      </div>
    </Card>
  );
}

function McResult({ sorted, confidence, backtest }: { sorted: number[]; confidence: number; backtest: number }) {
  const at = atConfidence(sorted, confidence);
  // histogram of simulated max drawdowns, deepest on the left
  const bins = 28;
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of sorted) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  const top = Math.max(...counts);
  const ratio = backtest ? at / backtest : 0;
  const k = (v: number) => `${v < 0 ? '−' : ''}₹${Math.round(Math.abs(v) / 1000)}K`;

  return (
    <div className="flex flex-col gap-2.5">
      <div role="img" aria-label="Distribution of simulated max drawdowns" className="flex h-[86px] items-end gap-[2px] border-b border-border-control">
        {counts.map((c, i) => {
          const binHi = lo + (i + 1) * w;
          return (
            <span
              key={i}
              title={`${c} simulations`}
              className={`grow rounded-t-[2px] ${binHi <= at ? 'bg-heat-loss-3' : 'bg-border-strong'}`}
              style={{ height: `${Math.max(2, (c / top) * 100)}%` }}
            />
          );
        })}
      </div>
      <span className="flex justify-between text-[10.5px] text-text-subtle tabular-nums"><span>{k(lo)}</span><span>deeper ← → shallower</span><span>{k(hi)}</span></span>
      <p className="m-0 flex gap-2 rounded-control bg-error-bg px-3 py-2.5 text-label text-error">
        <span aria-hidden="true">●</span>
        <span>
          With {confidence}% confidence the max drawdown stays above <b className="font-semibold">{rupees(Math.round(at / 100) * 100)}</b>
          {ratio > 0 ? `, ${ratio.toFixed(1)}× the backtest’s ${rupees(Math.round(backtest))}` : ''}. Plan capital for the deeper number.
        </span>
      </p>
    </div>
  );
}

const SPLITS = [0.5, 0.6, 0.7, 0.8];

function InOutSampleCard({ view }: { view: ResultsView }) {
  const { split, splitOnChart, set } = useResultsView();
  const computed = inOutSample(view.trades, split);
  // the real run at its own split uses the figures from the results file
  const r = view.exact && split === IN_OUT.split ? { ...computed, in: IN_OUT.in, out: IN_OUT.out } : computed;
  const rows: [string, (x: SampleRow) => string, (x: SampleRow) => number][] = [
    ['Net P&L', (x) => rupees(Math.round(x.netPnl)), (x) => x.netPnl],
    ['Win rate', (x) => `${x.winRate.toFixed(1)}%`, () => 0],
    ['Max drawdown', (x) => rupees(Math.round(x.maxDrawdown)), (x) => x.maxDrawdown],
    ['Expectancy', (x) => num(x.expectancy), (x) => x.expectancy],
  ];
  return (
    <Card title="In-sample vs out-of-sample" right={<InfoTip text={TIPS.inOut} />}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="m-0 text-label text-text-secondary">
          Splits the period in two. If the second half (never used to tune the strategy) holds up, the results are less likely to be curve-fitted.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-label text-text-secondary">
          Split at
          <select
            value={split}
            aria-label="Split"
            // choosing a split also shows it on the equity curve
            onChange={(e) => set({ split: Number(e.target.value), splitOnChart: true })}
            className="h-7 rounded-chip border border-border-chip bg-surface px-1.5 text-label font-semibold text-text-primary outline-none focus:border-brand"
          >
            {SPLITS.map((s) => <option key={s} value={s}>{Math.round(s * 100)} / {Math.round((1 - s) * 100)}</option>)}
          </select>
          <span className="text-text-tertiary">· {r.inRange} | {r.outRange}</span>
        </div>
        <table className="w-full border-collapse text-body tabular-nums">
          <thead>
            <tr className="text-[10.5px] font-semibold tracking-[0.06em] text-text-tertiary">
              <th className="py-1.5 text-left font-semibold">METRIC</th>
              <th className="py-1.5 text-right font-semibold">IN-SAMPLE</th>
              <th className="py-1.5 text-right font-semibold">OUT-OF-SAMPLE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f, v]) => (
              <tr key={label} className="border-t border-border-subtle">
                <td className="py-2 text-text-secondary">{label}</td>
                <td className={`py-2 text-right font-semibold ${tone(v(r.in))}`}>{f(r.in)}</td>
                <td className={`py-2 text-right font-semibold ${tone(v(r.out))}`}>{f(r.out)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 flex gap-2 rounded-control bg-brand-tint px-3 py-2.5 text-label text-text-secondary">
          <span aria-hidden="true" className="font-semibold text-brand">≈</span>
          {sampleVerdict(r.in, r.out)}
        </p>
        <div>
          <button type="button" onClick={() => set({ splitOnChart: !splitOnChart })} className="text-label font-medium text-brand hover:underline">
            {splitOnChart ? 'Hide the split on the chart' : 'Show the split on the chart'}
          </button>
        </div>
      </div>
    </Card>
  );
}
