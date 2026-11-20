export interface RankingItem {
  slug: string;
  name: string;
  owner: string;
  repo: string;
  description: string | null;
  category: string | null;
  harness: string | null;
  url: string;
  stars: number;
  delta: number | null;
  is_anomaly: boolean;
  repo_created_at: string | null;
  rank: number;
  prev_rank: number | null;
  growth: number | null;
}

export interface BoardResponse {
  board: string;
  as_of: string | null;
  window: number | null;
  items: RankingItem[];
  total?: number;
  reason?: string;
}

export interface PluginDetail {
  slug: string;
  name: string;
  owner: string;
  repo: string;
  description: string | null;
  category: string | null;
  harness: string | null;
  url: string;
  status: string;
  archived: boolean;
  repo_created_at: string | null;
  added_at: string | null;
  as_of: string | null;
  stars: number | null;
  delta: number | null;
  is_anomaly: boolean;
  rank_total: number | null;
  rank_velocity: number | null;
  rank_growth7: number | null;
  rank_darkhorse7: number | null;
}

export interface SeriesPoint {
  date: string;
  stars: number;
  delta: number | null;
  is_anomaly: boolean;
}

export interface SeriesResponse {
  slug: string;
  days: number;
  as_of: string | null;
  items: SeriesPoint[];
}

export interface Dashboard {
  as_of: string | null;
  kpis: {
    total_stars: number;
    stars_delta: number;
    tracked: number;
    new_today: number;
    snapshots: number;
  };
  top_velocity: RankingItem[];
  top_growth: RankingItem[];
  top_total: RankingItem[];
  newest: RankingItem[];
}

export interface PluginListItem {
  slug: string;
  name: string;
  owner: string;
  repo: string;
  description: string | null;
  category: string | null;
  harness: string | null;
  url: string;
  stars: number | null;
  stars_at: string | null;
  repo_created_at: string | null;
  archived: boolean;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  as_of: string | null;
}

export interface CategorySummary {
  category: string;
  count: number;
  total_stars: number;
  top: { slug: string; name: string; stars: number }[];
}

export interface CategoriesResponse {
  as_of: string | null;
  items: CategorySummary[];
}

export interface ChangelogEntry {
  at: string | null;
  added: number;
  removed: number;
  changed: number;
  added_sample: string[];
  removed_sample: string[];
  changed_sample: string[];
}

export interface ChangelogResponse {
  items: ChangelogEntry[];
  as_of: string | null;
}
