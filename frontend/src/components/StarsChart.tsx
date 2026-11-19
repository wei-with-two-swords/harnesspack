import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { SeriesPoint } from '../types';

/**
 * Star history chart. Renders a placeholder until there are at least two
 * snapshots — the first day has no delta and a one-point line says nothing.
 */
export function StarsChart({ points, height = 240 }: { points: SeriesPoint[]; height?: number }) {
  const host = useRef<HTMLDivElement | null>(null);
  const chart = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || points.length < 2) return;

    const xs = points.map((p) => Math.round(Date.parse(`${p.date}T00:00:00Z`) / 1000));
    const ys = points.map((p) => p.stars);
    const data: uPlot.AlignedData = [xs, ys];

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [12, 10, 0, 0],
      legend: { show: false },
      cursor: { drag: { x: true, y: false, setScale: true } },
      scales: { x: { time: true } },
      axes: [
        {
          stroke: '#8b9bb4',
          grid: { stroke: '#1e2a3a', width: 1 },
          ticks: { stroke: '#1e2a3a' },
        },
        {
          stroke: '#8b9bb4',
          grid: { stroke: '#1e2a3a', width: 1 },
          ticks: { stroke: '#1e2a3a' },
          size: 60,
        },
      ],
      series: [
        {},
        {
          label: 'Star',
          stroke: '#4cc9f0',
          width: 2,
          fill: 'rgba(76,201,240,0.10)',
        },
      ],
    };

    chart.current = new uPlot(opts, data, el);
    const observer = new ResizeObserver(() => {
      if (chart.current && el.clientWidth > 0) {
        chart.current.setSize({ width: el.clientWidth, height });
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.current?.destroy();
      chart.current = null;
    };
  }, [points, height]);

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-4 text-center text-sm text-muted"
        style={{ height }}
      >
        数据积累中：每日快照累计 2 天后显示曲线
      </div>
    );
  }

  return <div ref={host} className="w-full" />;
}
