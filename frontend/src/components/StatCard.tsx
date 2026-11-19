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
    <div className="card card-pad">
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="num mt-2 text-2xl font-semibold text-white sm:text-3xl">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
