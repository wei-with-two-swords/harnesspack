import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { formatNumber } from '../lib/format';
import { type View } from '../components/CatalogSidebar';
import { BoardSwitcher } from '../components/BoardSwitcher';
import { GlobalSearch } from '../components/GlobalSearch';
import { RankTable } from '../components/RankTable';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import type { BoardResponse, CategoriesResponse, ListResponse, PluginListItem, StatusResponse } from '../types';

const PAGE_SIZE = 20;
const WINDOW_BOARDS = new Set(['growth', 'darkhorse', 'quality']);
const FIXED_BOARD_WINDOW: Record<string, number> = { darkhorse: 7, quality: 30 };

function parseView(params: URLSearchParams): View {
  const board = params.get('board');
  const range = params.get('range');
  const category = params.get('category');
  const sort = params.get('sort');
  const rawWindow = params.get('window');
  const requestedWindow = rawWindow === '30' ? 30 : 7;
  if (board === 'npm') {
    return { kind: 'npm', range: ['1y', 'ytd', '24h', '7d', '30d'].includes(range ?? '') ? range! : '1y' };
  }
  if (board === 'category') {
    return { kind: 'category', category: category ?? '' };
  }
  if (params.get('view') === 'directory') {
    const s = sort === 'downloads' || sort === 'category' ? sort : 'stars';
    return { kind: 'directory', sort: s };
  }
  const valid = ['velocity', 'growth', 'total', 'darkhorse', 'rookie', 'quality'];
  const selected = valid.includes(board ?? '') ? board! : 'total';
  const window = FIXED_BOARD_WINDOW[selected] ?? (selected === 'growth' ? requestedWindow : undefined);
  return { kind: 'star', board: selected, window };
}

function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = description;
  }, [title, description]);
}

export default function Home() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const view = parseView(params);
  const currentWindow = view.kind === 'star' ? (view.window ?? 7) : 7;
  const [page, setPage] = useState(0);

  const cats = useApi<CategoriesResponse>(() => api.categories(), []);
  const status = useApi<StatusResponse>(() => api.status(), []);
  const categories = (cats.data?.items ?? []).map((item) => item.category).sort();
  const tracked = status.data?.database.active ?? 0;
  const updated = status.data?.snapshots.as_of ?? null;

  useEffect(() => { setPage(0); }, [view.kind, view.kind === 'star' ? view.board : '', currentWindow]);

  const titleKey = view.kind === 'star' && view.board === 'growth'
    ? (currentWindow === 30 ? 'board.window30' : 'board.window7')
    : view.kind === 'star' ? `board.${view.board}`
    : view.kind === 'npm' ? `board.npm.${view.range}`
    : view.kind === 'category' ? 'board.category'
    : 'catalog.directory';
  const descKey = view.kind === 'star' ? `desc.${view.board}`
    : view.kind === 'npm' ? 'desc.npm'
    : 'desc.category';
  usePageMeta(`${t(titleKey)} · HarnessPack`, t(descKey));

  const isBoard = view.kind === 'star' || view.kind === 'npm' || view.kind === 'category';
  const boardName = view.kind === 'category' ? 'total' : view.kind === 'star' ? view.board : 'npm';
  const range = view.kind === 'npm' ? view.range : undefined;
  const boardWindow = view.kind === 'star' && WINDOW_BOARDS.has(view.board) ? currentWindow : undefined;
  const catFilter = view.kind === 'category' ? view.category : undefined;

  const boardState = useApi<BoardResponse>(
    () => isBoard
      ? api.board(boardName, boardWindow, catFilter, PAGE_SIZE, page * PAGE_SIZE, range)
      : Promise.resolve({ board: '', as_of: null, window: null, items: [] } as BoardResponse),
    [isBoard, boardName, boardWindow, range, catFilter, page],
  );

  const dirState = useApi<ListResponse<PluginListItem>>(
    () => view.kind === 'directory' && view.sort !== 'category'
      ? api.plugins({ sort: view.sort === 'downloads' ? 'downloads' : 'stars', limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      : Promise.resolve({ items: [], total: 0, as_of: null } as ListResponse<PluginListItem>),
    [view.kind, view.kind === 'directory' ? view.sort : 'stars', page],
  );

  const heroTitle = <>DeepSeek Harness <em>{t('hero.title')}</em></>;

  const npmNotice = view.kind === 'npm' && boardState.data && !boardState.data.reason ? (
    <div className="alert alert-secondary py-2 px-3 fs-xs mb-3" role="note">
      {t('npm.notice')}
      {boardState.data.last_active_day ? ` ${t('npm.lastActive')}: ${boardState.data.last_active_day}.` : ''}
      {` ${t('npm.coverage')}: ${formatNumber(boardState.data.covered_packages ?? 0)}.`}
    </div>
  ) : null;

  let content: React.ReactNode;
  if (isBoard) {
    const { data, error, loading } = boardState;
    content = (
      <>
        {npmNotice}
        <div className="card overflow-hidden">
          {error ? <div className="p-3"><ErrorState error={error} /></div> : null}
          {loading ? <div className="p-3"><Loading /></div> : null}
          {!loading && !error && data ? (
            data.items.length ? (
              <>
                <RankTable items={data.items} board={boardName} />
                <div className="px-4 pb-3">
                  <Pager page={page} pageSize={PAGE_SIZE} total={data.total ?? data.items.length} onChange={setPage} />
                </div>
              </>
            ) : <EmptyState bare title={t('common.noData')}>{data.reason ?? ''}</EmptyState>
          ) : null}
        </div>
      </>
    );
  } else if (view.kind === 'directory' && view.sort === 'category') {
    content = <div className="card"><div className="card-body fs-sm fg-secondary">{t('desc.category')}</div></div>;
  } else {
    const { data, error, loading } = dirState;
    content = (
      <div className="card overflow-hidden">
        {error ? <div className="p-3"><ErrorState error={error} /></div> : null}
        {loading ? <div className="p-3"><Loading /></div> : null}
        {!loading && !error && data ? (
          data.items.length ? (
            <>
              <ul className="list-group list-group-flush">
                {data.items.map((item) => (
                  <li key={item.slug} className="list-group-item list-group-item-action p-0">
                    <Link to={`/plugins/${item.slug}`} className="d-flex align-items-center gap-3 px-4 py-3 text-decoration-none">
                      <span className="min-w-0 flex-grow-1">
                        <span className="d-block text-truncate fw-medium">{item.name}</span>
                        <span className="d-block text-truncate text-xs fg-secondary">{item.owner}/{item.repo}</span>
                      </span>
                      <span className="num fs-sm fg-secondary flex-shrink-0">
                        {view.sort === 'downloads'
                          ? `${formatNumber(item.downloads ?? 0)} ↓`
                          : `★ ${formatNumber(item.stars ?? 0)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="px-4 pb-3"><Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} /></div>
            </>
          ) : <EmptyState bare title={t('common.noData')} />
        ) : null}
      </div>
    );
  }

  return (
    <section>
      <div className="hp-hero p-4 lg:p-5 mb-4">
        <div className="hero-grid">
          <div>
            <h1 className="hero-title">{heroTitle}</h1>
            <p className="hero-lead">{t('hero.lead')}</p>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">{t('hero.tracked')}</div>
            <div className="hero-stat-value">{tracked ? formatNumber(tracked) : '—'}</div>
            <div className="hero-stat-foot">{updated ? `${t('hero.updated')} ${updated}` : '—'}</div>
          </div>
        </div>
        <div className="mt-4"><GlobalSearch /></div>
      </div>

      <BoardSwitcher view={view} categories={categories} />
      {content}
    </section>
  );
}
