import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface/40 px-4 py-8 text-center">
      <div className="text-sm font-medium text-body">{title}</div>
      {children ? <div className="mx-auto mt-2 max-w-lg text-xs text-muted">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="rounded-lg border border-fall/30 bg-fall/5 px-4 py-6 text-sm text-fall">
      加载失败：{error.message}
    </div>
  );
}

export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-raise/60" />
      ))}
    </div>
  );
}
