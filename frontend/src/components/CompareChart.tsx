import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { ComparePlugin } from '../types';

const COLORS = ['#4cc9f0', '#f5b544', '#4ade80', '#f87171', '#a78bfa'];

/**
 * Multi-series star chart for the compare page. Missing days are gaps, not
 * interpolated — same rule as the single-plugin chart.
 */
export function CompareChart({ plugins, height = 320 }: { plugins: ComparePlugin[]; height?: number }) {
  const host = useRef<HTMLDivElement | null>(null);
  const chart = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const dates = Array.from(
      new Set(plugins.flatMap((p) => p.series.map((point) => point.date))),
    ).sort();
    if (dates.length < 2) return;

    const xs = dates.map((d) => Math.round(Date.parse(`${d}T00:00:00Z`) / 1000));
    const data: uPlot.AlignedData = [
      xs,
      ...plugins.map((plugin) => {
        const byDate = new Map(plugin.series.map((point) => [point.date, point.stars]));
        return dates.map((d) => byDate.get(d) ?? null);
      }),
    ];

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [12, 10, 0, 0],
      legend: { show: true, live: false },
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
        ...plugins.map((plugin, i) => ({
          label: plugin.name,
          stroke: COLORS[i % COLORS.length],
          width: 2,
        })),
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
  }, [plugins, height]);

  if (plugins.every((p) => p.series.length < 2)) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-4 text-center text-sm text-muted"
        style={{ height }}
      >
        数据积累中：每日快照累计 2 天后显示对比曲线
      </div>
    );
  }

  return <div ref={host} className="w-full" />;
}
