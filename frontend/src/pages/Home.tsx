import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { HOME_POS_KEY } from '../lib/homePosition';
import { ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { useThemeVersion } from '../lib/theme';
import { formatNumber } from '../lib/format';
import { type View } from '../components/CatalogSidebar';
import { BoardSwitcher } from '../components/BoardSwitcher';
import { BoardToolbar } from '../components/BoardToolbar';
import { GlobalSearch } from '../components/GlobalSearch';
import { RankTable } from '../components/RankTable';
import { PluginList } from '../components/PluginList';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { FriendLinkModal } from '../components/FriendLinkModal';
import { SubmitModal } from '../components/SubmitModal';
import { HeroRankChart } from '../components/HeroRankChart';
import { copyText } from '../lib/clipboard';
import type { BoardResponse, CategoriesResponse, ListResponse, PluginListItem, StatusResponse } from '../types';

const PAGE_SIZE = 20;
const WINDOW_BOARDS = new Set(['growth', 'darkhorse', 'quality']);
const FIXED_BOARD_WINDOW: Record<string, number> = { darkhorse: 7, quality: 30 };
/** Per-session list cache: returning from a detail page renders the last
 * seen page instantly (stale-while-revalidate) so the scroll restore lands
 * on a full-height document instead of a collapsed loading placeholder. */
const listCache = new Map<string, unknown>();

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
    return { kind: 'directory', sort: s, category: s === 'category' ? (category ?? '') : undefined };
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

function InstallCommand({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="hero-install-item">
      <span className="hero-install-label">{label}</span>
      <div className="hero-install-row">
        <code className="hero-install-code">{value}</code>
        <button type="button" onClick={handleCopy} aria-label={`${t('common.copy')} ${label}`}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  useThemeVersion();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const view = parseView(params);
  const currentWindow = view.kind === 'star' ? (view.window ?? 7) : 7;
  // Page lives in the URL (?page=1-based) so the browser back / the detail
  // page's "back to home" link restores the page the user was browsing.
  const page = Math.max(0, (Number.parseInt(params.get('page') ?? '', 10) || 1) - 1);
  const boardAnchor = useRef<HTMLDivElement | null>(null);

  const cats = useApi<CategoriesResponse>(() => api.categories(), []);
  const status = useApi<StatusResponse>(() => api.status(), []);
  const categories = (cats.data?.items ?? []).map((item) => item.category).sort();
  const tracked = status.data?.database.active ?? 0;
  const updated = status.data?.snapshots.as_of ?? null;
  const trackingDays = status.data?.snapshots.days ?? 0;
  const addedToday = status.data?.database.added_today ?? 0;
  const exitedToday = status.data?.database.exited_today ?? 0;
  const netToday = addedToday - exitedToday;
  const changeDetail = `${t('hero.addedToday')} ${addedToday} · ${t('hero.exitedToday')} ${exitedToday}`;
  const [friendOpen, setFriendOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  const changePage = (next: number) => {
    const nextParams = new URLSearchParams(params);
    if (next <= 0) nextParams.delete('page');
    else nextParams.set('page', String(next + 1));
    setParams(nextParams, { replace: true });
    // Land the fresh page at the top of the board (tab row), not the hero.
    const anchor = boardAnchor.current;
    if (anchor) {
      const top = anchor.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, Math.round(top)) });
    }
  };

  // Remember where the user was on this view while they browse list rows;
  // restored once data is ready after coming back from a detail page.
  const scrollRef = useRef(0);
  useEffect(() => {
    scrollRef.current = window.scrollY;
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      try {
        sessionStorage.setItem(
          HOME_POS_KEY,
          JSON.stringify({ search: location.search, y: Math.round(scrollRef.current) }),
        );
      } catch { /* ignore */ }
    };
  }, [location.search]);

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
  const boardCacheKey = isBoard
    ? `board:${boardName}:${boardWindow ?? ''}:${catFilter ?? ''}:${range ?? ''}:${page}` : '';
  const dirCacheKey = view.kind === 'directory' ? `dir:${view.sort}:${view.category ?? ''}:${page}` : '';

  const boardState = useApi<BoardResponse>(
    () => api.board(boardName, boardWindow, catFilter, PAGE_SIZE, page * PAGE_SIZE, range)
      .then((data) => { listCache.set(boardCacheKey, data); return data; }),
    [isBoard, boardName, boardWindow, range, catFilter, page],
    (listCache.get(boardCacheKey) as BoardResponse | undefined) ?? null,
  );

  const dirSort = view.kind === 'directory' && view.sort === 'downloads' ? 'downloads' : 'stars';
  const dirCategory = view.kind === 'directory' && view.sort === 'category' ? (view.category || '') : '';
  const dirState = useApi<ListResponse<PluginListItem>>(
    () => api.plugins({
      sort: dirSort,
      category: dirCategory || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then((data) => { listCache.set(dirCacheKey, data); return data; }),
    [view.kind, dirSort, dirCategory, page],
    (listCache.get(dirCacheKey) as ListResponse<PluginListItem> | undefined) ?? null,
  );

  // Restore the saved scroll position once the list data for this view is
  // available — with the list cache this is the same effect batch as the
  // mount, so no top-of-page flash is painted. Browser reloads (location
  // key "default") always start at the top instead.
  const restoreState = view.kind === 'directory' ? dirState : boardState;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (location.key === 'default') return;
    if (!restoreState.data) return;
    restoredRef.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(HOME_POS_KEY) ?? 'null') as
        | { search: string; y: number }
        | null;
      if (saved && saved.search === location.search && saved.y > 0) {
        requestAnimationFrame(() => window.scrollTo(0, saved.y));
      }
    } catch { /* ignore */ }
  }, [restoreState.data, location.search, location.key]);

  const heroTitle = <>DeepSeek Harness <em>{t('hero.title')}</em></>;

  const toolbar = (
    <BoardToolbar
      fetchPage={(limit, offset) =>
        isBoard
          ? api.board(boardName, boardWindow, catFilter, limit, offset, range)
          : api.plugins({ sort: dirSort, category: dirCategory || undefined, limit, offset })
      }
      fileHint={
        isBoard
          ? `${boardName}${boardWindow ? `-${boardWindow}` : ''}${catFilter ? `-${catFilter}` : ''}${range ? `-${range}` : ''}`
          : `directory-${dirSort}${dirCategory ? `-${dirCategory}` : ''}`
      }
    />
  );

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
          {loading && !data ? <div className="p-3"><Loading /></div> : null}
          {data && !error ? (
            data.items.length ? (
              <>
                <RankTable items={data.items} board={boardName} window={boardWindow} />
                <div className="px-4 pb-3">
                  <Pager page={page} pageSize={PAGE_SIZE} total={data.total ?? data.items.length} onChange={changePage} scrollOnChange={false} />
                </div>
              </>
            ) : loading ? null : <EmptyState bare title={t('common.noData')}>{data.reason ?? ''}</EmptyState>
          ) : null}
        </div>
      </>
    );
  } else {
    const { data, error, loading } = dirState;
    content = (
      <div className="card overflow-hidden">
        {error ? <div className="p-3"><ErrorState error={error} /></div> : null}
        {loading && !data ? <div className="p-3"><Loading /></div> : null}
        {data && !error ? (
          data.items.length ? (
            <>
              <PluginList
                items={data.items}
                sort={view.sort === 'downloads' ? 'downloads' : 'stars'}
                offset={page * PAGE_SIZE}
              />
              <div className="px-4 pb-3"><Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={changePage} scrollOnChange={false} /></div>
            </>
          ) : loading ? null : <EmptyState bare title={t('common.noData')} />
        ) : null}
      </div>
    );
  }

  return (
    <section>
      <div className="hp-hero p-4 lg:p-5 mb-4">
        <HeroRankChart />
        <div className="hero-grid">
          <div className="hero-copy">
            <img
              className="hero-logo"
              src="/favicon-180.png"
              alt=""
              aria-hidden="true"
              width="88"
              height="88"
            />
            <div className="min-w-0">
              <h1 className="hero-title">{heroTitle}</h1>
              <p className="hero-lead">{t('hero.lead')}</p>
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">{t('hero.tracked')}</div>
            <div className="hero-stat-value">{tracked ? formatNumber(tracked) : '—'}</div>
            <div className="hero-updated">
              <span className={`hero-updated-dot${updated ? ' is-live' : ''}`} aria-hidden="true" />
              <span>{updated ? `${t('hero.asOf')} ${updated}` : '—'}</span>
            </div>
            <div className="hero-tracking">
              {trackingDays ? `${t('hero.tracking')} ${trackingDays} ${t('hero.days')}` : '—'}
            </div>
            {status.data ? (
              <div
                className={`hero-change ${netToday > 0 ? 'fg-success' : netToday < 0 ? 'fg-danger' : 'fg-secondary'}`}
                title={changeDetail}
              >
                {t('hero.changeToday')} {netToday > 0 ? '+' : ''}{netToday}
              </div>
            ) : null}
          </div>
        </div>
        <div className="hero-install">
          <div className="hero-install-title">{t('hero.install')} · dsh-market</div>
          <InstallCommand label={t('hero.installNpm')} value="npm install dshmarket" />
          <InstallCommand label={t('hero.installDsh')} value="dsh plugin --profile web add dshmarket" />
        </div>
        <div className="hero-links">
          <a
            href="https://github.com/wei-with-two-swords"
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('hero.author')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
          <a href="https://dshmarket.com" target="_blank" rel="noreferrer noopener">
            {t('hero.market')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
          <button type="button" onClick={() => setSubmitOpen(true)}>{t('hero.submit')}</button>
          <button type="button" onClick={() => setFriendOpen(true)}>{t('hero.friendLink')}</button>
        </div>
      </div>

      <FriendLinkModal open={friendOpen} onClose={() => setFriendOpen(false)} />
      <SubmitModal open={submitOpen} onClose={() => setSubmitOpen(false)} />

      <div className="mb-4"><GlobalSearch /></div>

      <div ref={boardAnchor}>
        <BoardSwitcher view={view} categories={categories} actions={toolbar} />
      </div>
      {content}
    </section>
  );
}
