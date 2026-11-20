import type { ReactNode } from 'react';

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
        <div className="mx-auto mt-2 fg-secondary" style={{ maxWidth: '32rem' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
  return bare ? body : <div className="card">{body}</div>;
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="alert theme-danger bg-subtle-danger" role="alert">
      加载失败：{error.message}
    </div>
  );
}

export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="d-flex flex-column gap-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="placeholder-glow">
          <span className="placeholder w-100 d-block rounded-3" style={{ height: '2.75rem' }} />
        </div>
      ))}
    </div>
  );
}
