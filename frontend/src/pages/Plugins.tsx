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
        <h1 className="fs-3xl fw-semibold mb-1">插件库</h1>
        <p className="fs-sm fg-secondary mb-0" style={{ maxWidth: '42rem' }}>
          名单来自 awesome-dsh-plugin 清单，共 {data ? formatNumber(data.total) : '上万'} 个可安装进 DSH
          的插件；按 star、名称或创建时间浏览。
        </p>
      </div>

      <div className="card mb-4">
        <div className="card-body d-flex flex-column sm:flex-row sm:align-items-center gap-3">
          <div className="input-group flex-grow-1">
            <span className="input-group-text">⌕</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="搜索名称、owner、仓库或描述"
              className="form-control"
              aria-label="搜索插件"
            />
          </div>
          <div className="d-flex gap-2">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="form-control"
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
              className="form-control"
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
      </div>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        data.items.length > 0 ? (
          <>
            <ul className="card list-group list-group-flush overflow-hidden">
              {data.items.map((item) => (
                <li key={item.slug} className="list-group-item p-0">
                  <Link
                    to={`/plugins/${item.slug}`}
                    className="d-flex align-items-center gap-3 px-4 py-3 text-decoration-none"
                  >
                    <div className="min-w-0 flex-grow-1">
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-truncate fw-medium">{item.name}</span>
                        {item.category ? (
                          <span className="badge theme-secondary badge-subtle flex-shrink-0 d-none sm:d-inline-flex">
                            {categoryLabel(item.category)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-truncate mb-0 fs-xs fg-secondary">
                        {item.owner}/{item.repo}
                        {item.description ? ` · ${item.description}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-end">
                      <div className="num fg-body fs-sm">
                        {item.stars === null ? '—' : formatNumber(item.stars)}
                      </div>
                      <div className="fs-xs fg-secondary">
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
