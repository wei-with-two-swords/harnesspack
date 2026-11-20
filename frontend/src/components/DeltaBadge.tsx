import { formatDelta } from '../lib/format';

export function DeltaBadge({
  value,
  anomaly = false,
  suffix,
}: {
  value: number | null;
  anomaly?: boolean;
  suffix?: string;
}) {
  const text = suffix ? `${formatDelta(value)}${suffix}` : formatDelta(value);
  const tone =
    value === null
      ? 'fg-secondary'
      : value > 0
        ? 'fg-success'
        : value < 0
          ? 'fg-danger'
          : 'fg-secondary';
  return (
    <span className={`num d-inline-flex align-items-center gap-1 ${tone}`}>
      {text}
      {anomaly ? (
        <span
          className="badge theme-warning badge-subtle"
          title="单日涨幅异常，已标记但仍保留数据"
        >
          异常
        </span>
      ) : null}
    </span>
  );
}
