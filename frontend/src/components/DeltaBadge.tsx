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
      ? 'text-muted'
      : value > 0
        ? 'text-rise'
        : value < 0
          ? 'text-fall'
          : 'text-muted';
  return (
    <span className={`num inline-flex items-center gap-1 ${tone}`}>
      {text}
      {anomaly ? (
        <span className="pill border-gold/40 text-gold" title="单日涨幅异常，已标记但仍保留数据">
          异常
        </span>
      ) : null}
    </span>
  );
}
