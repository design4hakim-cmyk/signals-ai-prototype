import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Trade } from '@/lib/signals';
import type { Candle } from '@/types/market';

/*
  TradingView Lightweight Charts wrapped as a React component.
  The library draws on its own <canvas>, so we read our token values
  from CSS and pass them in. Change a token → the chart follows.
  Entries = green ▲ under the candle, exits = red ▼ above it.
*/

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function PriceChart({ candles, trades }: { candles: Candle[]; trades?: Trade[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const buy = token('--color-buy');
    const sell = token('--color-sell');

    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: token('--color-surface') },
        textColor: token('--color-text-tertiary'),
        fontFamily: token('--font-sans'),
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: token('--color-chart-grid') } },
      rightPriceScale: { borderColor: token('--color-border-subtle') },
      timeScale: { borderColor: token('--color-border-subtle'), timeVisible: true, barSpacing: 10 },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: buy,
      downColor: sell,
      wickUpColor: buy,
      wickDownColor: sell,
      borderVisible: false,
    });
    series.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));

    if (trades?.length) {
      const markers: SeriesMarker<Time>[] = [];
      for (const t of trades) {
        markers.push({ time: t.entryTime as UTCTimestamp, position: 'belowBar', color: buy, shape: 'arrowUp', size: 0.8 });
        if (t.exitTime !== null)
          markers.push({ time: t.exitTime as UTCTimestamp, position: 'aboveBar', color: sell, shape: 'arrowDown', size: 0.8 });
      }
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(series, markers);
    }

    chart.timeScale().scrollToRealTime();
    return () => chart.remove();
  }, [candles, trades]);

  return <div ref={ref} className="h-full w-full" />;
}
