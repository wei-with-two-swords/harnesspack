import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n, categoryLabel } from '../lib/i18n';
import { formatNumber } from '../lib/format';
import { CatalogSidebar, viewToUrl, type View } from '../components/CatalogSidebar';
import { GlobalSearch } from '../components/GlobalSearch';
import { RankTable } from '../components/RankTable';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import type { BoardResponse, CategoriesResponse, ListResponse, PluginListItem } from '../types';

const PAGE_SIZE = 20;
const WINDOW_BOARDS = new Set(['growth', 'darkhorse', 'quality']);

function parseView(params: URLSearchParams): View {
  const board = params.get('board');
  const range = params.get('range');
  const category = params.get('category');
  const sort = params.get('sort');
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
  return { kind: 'star', board: valid.includes(board ?? '') ? board! : 'total' };
}

function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = description;
  }, [title, description]);
}

export default function Home() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const view = parseView(params);
  const [window, setWindow] = useState(7);
  const [page, setPage] = useState(0);

  const cats = useApi<CategoriesResponse>(() => api.categories(), []);
  const categories = (cats.data?.items ?? []).map((item) => item.category).sort();

  useEffect(() => { setPage(0); }, [view.kind, window]);

  const titleKey = view.kind === 'star' ? `board.${view.board}`
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
  const boardWindow = view.kind === 'star' && WINDOW_BOARDS.has(view.board) ? window : undefined;
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

  const period = view.kind === 'star' && WINDOW_BOARDS.has(view.board);

  const header = (
    <header className="mb-4">
      <h1 className="fs-3xl fw-semibold mb-2">{t(titleKey)}</h1>
      <p className="fs-sm fg-secondary mb-3" style={{ maxWidth: '44rem' }}>{t(descKey)}</p>
      <GlobalSearch />
    </header>
  );

  const periodSwitch = period ? (
    <div className="btn-group btn-group-sm mb-3" role="group" aria-label={t('table.period')}>
      {[7, 30].map((option) => (
        <button key={option} type="button" onClick={() => setWindow(option)}
          aria-pressed={window === option}
          className={`btn ${window === option ? 'btn-solid theme-secondary active' : 'btn-outline'}`}>
          {t(option === 7 ? 'common.window7' : 'common.window30')}
        </button>
      ))}
    </div>
  ) : null;

  const showCatChips = view.kind === 'category' || (view.kind === 'directory' && view.sort === 'category');
  const categoryChips = showCatChips ? (
    <div className="d-flex flex-wrap gap-2 mb-3">
      <Link to={viewToUrl({ kind: 'category', category: '' })}
        className={`btn btn-sm ${view.kind === 'category' && !view.category ? 'btn-solid theme-secondary' : 'btn-outline'}`}>
        {t('catalog.all')}
      </Link>
      {categories.map((cat) => (
        <Link key={cat} to={viewToUrl({ kind: 'category', category: cat })}
          className={`btn btn-sm ${view.kind === 'category' && view.category === cat ? 'btn-solid theme-secondary' : 'btn-outline'}`}>
          {categoryLabel(lang, cat)}
        </Link>
      ))}
    </div>
  ) : null;

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
        {periodSwitch}
        {categoryChips}
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
    content = <>{categoryChips}<div className="card"><div className="card-body fs-sm fg-secondary">{t('desc.category')}</div></div></>;
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
                        <span className="d-block text-truncate fs-xs fg-secondary">{item.owner}/{item.repo}</span>
                      </span>
                      <span className="num fs-sm fg-secondary flex-shrink-0">
                        {view.sort === 'downloads'
                          ? `${formatNumber(item.downloads ?? 0)} ↓`
                          : `★ ${formatNumber(item.stars)}`}
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
      {header}
      <div className="workspace">
        <CatalogSidebar view={view} />
        <div className="min-w-0">{content}</div>
      </div>
    </section>
  );
}
