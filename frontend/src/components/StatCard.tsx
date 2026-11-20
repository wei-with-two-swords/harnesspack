import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="card h-100 hp-hover">
      <div className="card-body">
        <div className="fs-xs text-uppercase fg-secondary fw-semibold">{label}</div>
        <div className="num mt-2 fs-3xl fw-semibold">{value}</div>
        {hint ? <div className="mt-1 fs-sm fg-secondary">{hint}</div> : null}
      </div>
    </div>
  );
}
