import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { SeriesPoint } from '../types';
import { chartColors, useThemeVersion } from '../lib/theme';

/**
 * Star history chart. Renders a placeholder until there are at least two
 * snapshots — the first day has no delta and a one-point line says nothing.
 */
export function StarsChart({ points, height = 240 }: { points: SeriesPoint[]; height?: number }) {
  const host = useRef<HTMLDivElement | null>(null);
  const chart = useRef<uPlot | null>(null);
  const themeVersion = useThemeVersion();

  useEffect(() => {
    const el = host.current;
    if (!el || points.length < 2) return;

    const xs = points.map((p) => Math.round(Date.parse(`${p.date}T00:00:00Z`) / 1000));
    const ys = points.map((p) => p.stars);
    const data: uPlot.AlignedData = [xs, ys];
    const colors = chartColors();

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [12, 10, 0, 0],
      legend: { show: false },
      cursor: { drag: { x: true, y: false, setScale: true } },
      scales: { x: { time: true } },
      axes: [
        {
          stroke: colors.axis,
          grid: { stroke: colors.grid, width: 1 },
          ticks: { stroke: colors.grid },
        },
        {
          stroke: colors.axis,
          grid: { stroke: colors.grid, width: 1 },
          ticks: { stroke: colors.grid },
          size: 60,
        },
      ],
      series: [
        {},
        {
          label: 'STAR',
          stroke: colors.line,
          width: 2,
          fill: colors.fill,
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
  }, [points, height, themeVersion]);

  if (points.length < 2) {
    return (
      <div
        className="d-flex align-items-center justify-content-center border rounded-3 px-3 text-center fs-sm fg-secondary"
        style={{ height }}
      >
        数据积累中：每日快照累计 2 天后显示曲线
      </div>
    );
  }

  return <div ref={host} className="w-100" />;
}
