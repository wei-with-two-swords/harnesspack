import { formatDelta } from '../lib/format';
import { useI18n } from '../lib/i18n';

export function DeltaBadge({
  value,
  anomaly = false,
  suffix,
}: {
  value: number | null;
  anomaly?: boolean;
  suffix?: string;
}) {
  const { t } = useI18n();
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
          title={t('delta.anomalyTitle')}
        >
          {t('delta.anomaly')}
        </span>
      ) : null}
    </span>
  );
}
