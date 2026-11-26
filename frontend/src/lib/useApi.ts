import { useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Minimal data-loading hook: one request per dependency change, safe on
 * unmount. `initialData` renders stale content immediately (e.g. the home
 * list cache when returning from a detail page) while the request runs.
 */
export function useApi<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  initialData: T | null = null,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: initialData, error: null, loading: true });

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loader()
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (alive) {
          setState({
            data: null,
            error: err instanceof Error ? err : new Error(String(err)),
            loading: false,
          });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
