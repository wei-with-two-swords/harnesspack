import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import { categoryLabel, formatDate, formatNumber } from '../lib/format';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import type { CategoriesResponse, ListResponse, PluginListItem } from '../types';

const PAGE_SIZE = 50;
const SORTS = [
  { id: 'stars', label: 'Star 总量' },
  { id: 'name', label: '名称' },
  { id: 'recent', label: '最新创建' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

export default function Plugins() {
  useTitle('插件库', '搜索 11,000+ 个可安装进 DeepSeek Harness 的插件，查看 star、分类与收录时间。');

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortId>('stars');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    setPage(0);
  }, [query, category, sort]);

  const cats = useApi<CategoriesResponse>(() => api.categories(), []);
  const { data, error, loading } = useApi<ListResponse<PluginListItem>>(
    () =>
      api.plugins({
        query: query || undefined,
        category: category || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    [query, category, sort, page],
  );

  return (
    <section>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-white">插件库</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          名单来自 awesome-dsh-plugin 清单，共 {data ? formatNumber(data.total) : '上万'} 个可安装进 DSH
          的插件；按 star、名称或创建时间浏览。
        </p>
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            ⌕
          </span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="搜索名称、owner、仓库或描述"
            className="w-full rounded-lg border border-line bg-raise py-2 pl-8 pr-3 text-sm text-body outline-none placeholder:text-muted focus:border-teal/60"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border border-line bg-raise px-3 py-2 text-sm text-body outline-none focus:border-teal/60"
            aria-label="分类"
          >
            <option value="">全部分类</option>
            {(cats.data?.items ?? []).map((item) => (
              <option key={item.category} value={item.category}>
                {categoryLabel(item.category)}（{item.count}）
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortId)}
            className="rounded-lg border border-line bg-raise px-3 py-2 text-sm text-body outline-none focus:border-teal/60"
            aria-label="排序"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        data.items.length > 0 ? (
          <>
            <ul className="card divide-y divide-line/60 overflow-hidden">
              {data.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={`/plugins/${item.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-raise/60 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-white">{item.name}</span>
                        {item.category ? (
                          <span className="pill hidden shrink-0 sm:inline-flex">
                            {categoryLabel(item.category)}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted">
                        {item.owner}/{item.repo}
                        {item.description ? ` · ${item.description}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="num text-sm text-body">
                        {item.stars === null ? '—' : formatNumber(item.stars)}
                      </div>
                      <div className="text-[11px] text-muted">
                        {item.repo_created_at
                          ? `建于 ${formatDate(item.repo_created_at)}`
                          : item.stars_at
                            ? formatDate(item.stars_at)
                            : ''}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState title="没有匹配的插件">换个关键词或清空分类筛选再试。</EmptyState>
        )
      ) : null}
    </section>
  );
}
