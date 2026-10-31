import { useEffect, useRef } from 'react';
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '@/types/market';

/*
  TradingView Lightweight Charts wrapped as a React component.
  The library draws on its own <canvas>, so we read our token values
  from CSS and pass them in. Change a token → the chart follows.
*/

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function PriceChart({ candles }: { candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const buy = token('--color-buy');
    const sell = token('--color-sell');

    const chart = createChart(ref.current, {
      autoSize: true, // resizes with the panel
      layout: {
        background: { type: ColorType.Solid, color: token('--color-surface') },
        textColor: token('--color-text-tertiary'),
        fontFamily: token('--font-sans'),
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: token('--color-chart-grid') },
      },
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
    chart.timeScale().scrollToRealTime(); // show the latest candles, like the design

    return () => chart.remove(); // clean up when the component goes away
  }, [candles]);

  return <div ref={ref} className="h-full w-full" />;
}
