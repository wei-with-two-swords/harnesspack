import type {
  BoardResponse,
  CategoriesResponse,
  ChangelogResponse,
  StatusResponse,
  CompareResponse,
  Dashboard,
  ListResponse,
  PluginDetail,
  PluginListItem,
  SeriesResponse,
} from '../types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const payload = (await res.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  dashboard: () => get<Dashboard>('/api/v1/dashboard'),
  board: (board: string, window?: number, category?: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (window) params.set('window', String(window));
    if (category) params.set('category', category);
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return get<BoardResponse>(
      `/api/v1/rankings/${encodeURIComponent(board)}${qs ? `?${qs}` : ''}`,
    );
  },
  categories: () => get<CategoriesResponse>('/api/v1/categories'),
  plugin: (slug: string) => get<PluginDetail>(`/api/v1/plugins/${encodeURIComponent(slug)}`),
  series: (slug: string, days = 90) =>
    get<SeriesResponse>(`/api/v1/plugins/${encodeURIComponent(slug)}/series?days=${days}`),
  plugins: (options: {
    query?: string;
    category?: string;
    sort?: 'stars' | 'name' | 'recent';
    limit?: number;
    offset?: number;
  } = {}) => {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    });
    if (options.query) params.set('query', options.query);
    if (options.category) params.set('category', options.category);
    if (options.sort) params.set('sort', options.sort);
    return get<ListResponse<PluginListItem>>(`/api/v1/plugins?${params.toString()}`);
  },
  changelog: (limit = 50) => get<ChangelogResponse>(`/api/v1/changelog?limit=${limit}`),
  status: () => get<StatusResponse>('/api/v1/status'),
  compare: (slugs: string[], days = 90) =>
    get<CompareResponse>(
      `/api/v1/compare?slugs=${encodeURIComponent(slugs.join(','))}&days=${days}`,
    ),
};
