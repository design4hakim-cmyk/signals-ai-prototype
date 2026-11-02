import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type BusinessDay,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { MONTHS, rupees, type EquityPoint, type Stats } from '@/lib/backtestData';
import { useResultsView } from '@/store/results';
import { Card } from './bits';

/*
  3 · Equity curve — one card, one chart, one shared time axis (Lightweight Charts panes).
    Top    cumulative P&L (blue, 2px) + NIFTY (grey) on its own scale, y in ₹K
    Bottom drawdown: red line + light red area between it and 0
  The max drawdown gets a dot + label, and a light red band with a bracket from peak to bottom.
  Hover: one dashed crosshair through both panes, one tooltip with the day's numbers.
  With the in/out-sample split shown, the out-of-sample part is tinted blue.
*/

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const toTime = (iso: string): Time => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day } as BusinessDay;
};
const isoOf = (t: Time) => {
  const b = t as BusinessDay;
  return `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
};
const kAxis = (v: number) => `${v < 0 ? '−' : ''}${Math.round(Math.abs(v) / 1000)}K`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

interface Overlay {
  ddBand?: { left: number; width: number; top: number; height: number };
  oos?: { left: number; width: number; height: number };
}

export function EquityChart({ equity, stats, splitDate }: { equity: EquityPoint[]; stats: Stats; splitDate: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; p: EquityPoint; w: number } | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({});
  const hoverDate = useResultsView((s) => s.hoverDate);
  const splitOnChart = useResultsView((s) => s.splitOnChart);
  const oosFrom = splitOnChart ? splitDate : null;

  // the bottom of the max drawdown, and the peak before it (worked out once per curve)
  const { bottom, peakIso } = useMemo(() => {
    const bottom = equity.reduce((m, p) => (p.drawdown < m.drawdown ? p : m), equity[0]);
    let peak = equity[0];
    for (const p of equity) {
      if (p.date > bottom.date) break;
      if (p.drawdown === 0) peak = p;
    }
    return { bottom, peakIso: peak.date };
  }, [equity]);

  useEffect(() => {
    const el = box.current;
    if (!el || !equity.length) return;
    const brand = token('--color-brand');
    const red = token('--color-sell');
    const byDate = new Map(equity.map((p) => [p.date, p]));

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: token('--color-text-tertiary'),
        fontFamily: token('--font-sans'),
        fontSize: 10.5,
        attributionLogo: false,
        panes: { separatorColor: token('--color-border-subtle'), enableResize: false },
      },
      grid: { vertLines: { visible: false }, horzLines: { color: token('--color-chart-grid') } },
      leftPriceScale: { visible: true, borderVisible: false },
      rightPriceScale: { visible: false },
      timeScale: {
        borderColor: token('--color-border-subtle'),
        tickMarkFormatter: (t: Time) => {
          const b = t as BusinessDay;
          return `${MONTHS[b.month - 1]} ${String(b.year).slice(2)}`;
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { style: LineStyle.Dashed, color: token('--color-text-subtle'), labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const fmt = { type: 'custom' as const, formatter: kAxis, minMove: 1 };
    const pnl = chart.addSeries(LineSeries, { color: brand, lineWidth: 2, priceScaleId: 'left', priceFormat: fmt, lastValueVisible: false, priceLineVisible: false, crosshairMarkerRadius: 3 });
    const nifty = chart.addSeries(LineSeries, { color: token('--color-chart-benchmark'), lineWidth: 1, priceScaleId: 'nifty', lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
    // drawdown in its own pane: red line, light red fill between it and 0
    const dd: ISeriesApi<'Baseline'> = chart.addSeries(
      BaselineSeries,
      {
        baseValue: { type: 'price', price: 0 },
        topLineColor: red,
        topFillColor1: rgba(red, 0.14),
        topFillColor2: rgba(red, 0.14),
        bottomLineColor: red,
        bottomFillColor1: rgba(red, 0.14),
        bottomFillColor2: rgba(red, 0.14),
        lineWidth: 1,
        priceScaleId: 'left',
        priceFormat: fmt,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerRadius: 3,
      },
      1,
    );
    chart.panes()[0].setHeight(210);
    chart.panes()[1].setHeight(96);

    pnl.setData(equity.map((p) => ({ time: toTime(p.date), value: p.cumPnl })));
    nifty.setData(equity.map((p) => ({ time: toTime(p.date), value: p.nifty })));
    dd.setData(equity.map((p) => ({ time: toTime(p.date), value: p.drawdown })));
    createSeriesMarkers(dd, [{ time: toTime(bottom.date), position: 'inBar', shape: 'circle', color: red, size: 0.6, text: `Max ${rupees(Math.round(bottom.drawdown))}` }]);
    chart.timeScale().fitContent();

    // HTML overlays (the drawdown band, the out-of-sample tint) follow the chart's coordinates
    const place = () => {
      const ts = chart.timeScale();
      const panes = chart.panes();
      const top0 = panes[0].getHTMLElement()?.getBoundingClientRect();
      const top1 = panes[1].getHTMLElement()?.getBoundingClientRect();
      const origin = el.getBoundingClientRect();
      const x = (iso: string) => ts.timeToCoordinate(toTime(iso)) ?? null;
      const axis = chart.priceScale('left', 0).width();
      const next: Overlay = {};
      const a = x(peakIso), b = x(bottom.date);
      if (a !== null && b !== null && top1) next.ddBand = { left: axis + a, width: Math.max(2, b - a), top: top1.top - origin.top, height: top1.height };
      if (oosFrom && top0 && top1) {
        const c = x(oosFrom);
        const end = ts.width();
        if (c !== null) next.oos = { left: axis + c, width: end - c, height: top1.bottom - top0.top };
      }
      setOverlay(next);
    };
    requestAnimationFrame(place);
    const ro = new ResizeObserver(() => requestAnimationFrame(place));
    ro.observe(el);

    // a scenario's forced tooltip goes away when its hover is switched off
    const unsub = useResultsView.subscribe((st, prev) => prev.hoverDate && !st.hoverDate && setTip(null));

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) return setTip(null);
      const p = byDate.get(isoOf(param.time));
      if (p) setTip({ x: param.point.x, y: param.point.y, p, w: el.clientWidth });
    });

    return () => {
      unsub();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [equity, bottom, peakIso, oosFrom]);

  // Scenarios: show the tooltip for a given day without hovering
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !hoverDate) return;
    const p = equity.find((e) => e.date >= hoverDate);
    if (!p) return;
    const x = chart.timeScale().timeToCoordinate(toTime(p.date));
    if (x === null) return;
    setTip({ x: x + chart.priceScale('left', 0).width(), y: 60, p, w: box.current?.clientWidth ?? 0 });
  }, [hoverDate, equity]);

  const legend = (
    <span className="flex items-center gap-3.5 text-label text-text-secondary">
      <span className="flex items-center gap-1.5"><span className="h-[2px] w-3.5 rounded bg-brand" />Cumulative P&L</span>
      <span className="flex items-center gap-1.5"><span className="h-px w-3.5 bg-chart-benchmark" />NIFTY</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[2px] bg-sell-tint" />Drawdown</span>
    </span>
  );

  return (
    <Card title="Equity curve" sub="NIFTY scaled to the same chart" right={legend}>
      <div role="img" aria-label="Cumulative P&L against NIFTY, with drawdown below" className="relative mx-3 mb-3 h-[340px]" onMouseLeave={() => setTip(null)}>
        <div ref={box} className="absolute inset-0" />
        {overlay.oos && (
          <div className="pointer-events-none absolute top-0" style={{ left: overlay.oos.left, width: overlay.oos.width, height: overlay.oos.height }}>
            <div className="absolute inset-0 bg-brand-tint opacity-70" />
            <div className="absolute top-0 bottom-0 left-0 border-l border-dashed border-brand" />
            <span className="absolute -top-0.5 right-full mr-1.5 text-hint whitespace-nowrap text-text-tertiary">In-sample</span>
            <span className="absolute -top-0.5 left-1.5 text-hint whitespace-nowrap text-brand-text">Out-of-sample</span>
          </div>
        )}
        {overlay.ddBand && (
          <div className="pointer-events-none absolute" style={overlay.ddBand}>
            <div className="absolute inset-0 bg-sell-tint opacity-60" />
            {/* bracket from peak to bottom */}
            <div className="absolute right-0 bottom-1.5 left-0 h-1.5 border-x border-b border-sell" />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10.5px] whitespace-nowrap text-sell-text">
              Max drawdown · peak to bottom · {stats.mdd_days} days
            </span>
          </div>
        )}
        <span className="pointer-events-none absolute top-[218px] right-2 text-[10.5px] text-text-tertiary">Drawdown</span>
        {tip && <Tooltip {...tip} flip={tip.x > tip.w - 230} />}
      </div>
    </Card>
  );
}

function Tooltip({ x, y, p, flip }: { x: number; y: number; p: EquityPoint; w: number; flip: boolean }) {
  const row = (dot: string, label: string, value: string, cls = 'text-text-primary') => (
    <span className="flex items-center gap-2">
      <span className={`size-2 rounded-[2px] ${dot}`} />
      <span className="grow text-text-secondary">{label}</span>
      <b className={`font-semibold tabular-nums ${cls}`}>{value}</b>
    </span>
  );
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 flex w-[200px] flex-col gap-1 rounded-control border border-border-control bg-surface p-2.5 text-label shadow-surface"
      // near the right edge it opens to the left of the crosshair
      style={{ left: flip ? x - 214 : x + 14, top: Math.max(4, y - 30) }}
    >
      <b className="mb-0.5 font-semibold">{longDate(p.date)}</b>
      {row('bg-brand', 'Cumulative P&L', rupees(Math.round(p.cumPnl)), p.cumPnl < 0 ? 'text-pnl-down' : 'text-pnl-up')}
      {row('bg-chart-benchmark', 'NIFTY', Math.round(p.nifty).toLocaleString('en-IN'))}
      {row('bg-sell', 'Drawdown', rupees(Math.round(p.drawdown)), p.drawdown < 0 ? 'text-pnl-down' : 'text-text-primary')}
      {row('bg-transparent', 'Day P&L', rupees(Math.round(p.dayPnl), { plus: true }), p.dayPnl < 0 ? 'text-pnl-down' : 'text-pnl-up')}
    </div>
  );
}
