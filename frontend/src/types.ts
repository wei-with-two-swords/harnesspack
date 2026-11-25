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
  real_delta?: number;
  observed_days?: number;
  anomaly_days?: number;
  npm_package?: string | null;
  downloads?: number;
  downloads_prev?: number | null;
  has_prev?: boolean;
}

export interface BoardResponse {
  board: string;
  as_of: string | null;
  window: number | string | null;
  last_active_day?: string | null;
  items: RankingItem[];
  total?: number;
  reason?: string;
  source?: string;
  metric?: string;
  unit?: string;
  is_approximate?: boolean;
  note?: string;
  covered_packages?: number;
}

export interface PeerItem {
  slug: string;
  name: string;
  stars: number;
  rank: number;
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
  stars_at: string | null;
  available: boolean;
  exited_at: string | null;
  exit_reason: string | null;
  delta: number | null;
  is_anomaly: boolean;
  rank_total: number | null;
  rank_velocity: number | null;
  rank_growth7: number | null;
  rank_darkhorse7: number | null;
  rank_quality7: number | null;
  rank_quality30: number | null;
  rank_category: number | null;
  rank_npm_24h: number | null;
  rank_npm_7d: number | null;
  rank_npm_30d: number | null;
  rank_npm_total: number | null;
  rank_npm_ytd: number | null;
  forks: number | null;
  pushed_at: string | null;
  license: string | null;
  topics: string[];
  default_branch: string | null;
  github_description: string | null;
  npm_package: string | null;
  downloads_24h: number | null;
  downloads_7d: number | null;
  downloads_30d: number | null;
  downloads_1y: number | null;
  downloads_ytd: number | null;
  npm_days_in_archive: number | null;
  npm_first_day: string | null;
  npm_last_day: string | null;
  peers: PeerItem[];
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
  downloads?: number;
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

export interface StatusSnapshot {
  date: string;
  total: number;
  ok: number;
  failed: number;
  elapsed_s: number | null;
  fetched_at: string | null;
}

export interface StatusFailure {
  slug: string;
  repo: string;
  status: string;
  error?: string;
}

export interface StatusResponse {
  snapshots: {
    as_of: string | null;
    first_date: string | null;
    days: number;
    seed_count: number;
    latest: StatusSnapshot | null;
    ok_rate: number | null;
    coverage: number | null;
    failures: StatusFailure[];
  };
  database: {
    as_of: string | null;
    plugins: number;
    active: number;
    exited: number;
    added_today: number;
    exited_today: number;
    unavailable: number;
    stars_rows: number;
    anomalies: number;
  };
  last_catalog_sync: { at: string; added: number; removed: number; changed: number } | null;
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

export interface ComparePlugin {
  slug: string;
  name: string;
  series: SeriesPoint[];
}

export interface CompareResponse {
  as_of: string | null;
  days: number;
  plugins: ComparePlugin[];
}

export interface CommunityAuthor {
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export interface CommunityPluginCard {
  slug: string;
  name: string;
  owner: string;
  repo: string;
  description: string | null;
  url: string;
  stars_latest: number | null;
  category: string | null;
  harness: string | null;
}

export interface CommunityPost {
  id: number;
  body: string;
  created_at: string;
  author: CommunityAuthor;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  plugins: CommunityPluginCard[];
}

export interface CommunityComment {
  id: number;
  post_id: number;
  body: string;
  created_at: string;
  author: CommunityAuthor;
  plugins: CommunityPluginCard[];
}

export interface CommunityList<T> {
  items: T[];
  total: number;
}

export interface CommunityUser extends CommunityAuthor {
  created_at?: string;
}

export interface CommunityProfile extends CommunityList<CommunityPost> {
  user: CommunityUser;
}

export interface LikeResult {
  liked: boolean;
  like_count: number;
}
