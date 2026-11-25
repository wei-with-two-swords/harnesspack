import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

export function EmptyState({
  title,
  children,
  bare = false,
}: {
  title: string;
  children?: ReactNode;
  bare?: boolean;
}) {
  const body = (
    <div className="card-body py-5 text-center">
      <div className="fw-medium">{title}</div>
      {children ? (
        <div className="mx-auto mt-2 fg-secondary" style={{ maxWidth: 'var(--measure-compact)' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
  return bare ? body : <div className="card">{body}</div>;
}

export function ErrorState({ error }: { error: Error }) {
  const { t } = useI18n();
  return (
    <div className="alert theme-danger bg-subtle-danger" role="alert">
      {t('common.loadFailed', { message: error.message })}
    </div>
  );
}

export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="d-flex flex-column gap-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="placeholder-glow">
          <span className="placeholder w-100 d-block rounded-3" style={{ height: 'var(--s-6)' }} />
        </div>
      ))}
    </div>
  );
}
