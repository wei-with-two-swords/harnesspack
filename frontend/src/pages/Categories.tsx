import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { CategoriesResponse } from '../types';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { categoryLabel, formatCompact, formatNumber } from '../lib/format';

export default function Categories() {
  const { data, error, loading } = useApi<CategoriesResponse>(api.categories, []);

  return (
    <section>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">分类榜</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          按功能域单独排榜：UI、上下文、模型、工具、媒体等分类各自计算名次，只统计在册的 DSH 插件。
        </p>
      </div>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading rows={3} /> : null}

      {data && data.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <Link
              key={item.category}
              to={`/rankings/category/${encodeURIComponent(item.category)}`}
              className="card card-pad group transition hover:border-teal/40"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-white group-hover:text-teal">
                  {categoryLabel(item.category)}榜
                </h2>
                <span className="num text-xs text-muted">{item.count} 个插件</span>
              </div>
              <div className="mt-1 num text-sm text-body">
                {formatNumber(item.total_stars)} star
              </div>
              <ol className="mt-3 space-y-1.5 border-t border-line/60 pt-3 text-xs">
                {item.top.map((entry) => (
                  <li key={entry.slug} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted">{entry.name}</span>
                    <span className="num shrink-0 text-body">{formatCompact(entry.stars)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 text-xs text-teal">查看 {categoryLabel(item.category)}榜 →</div>
            </Link>
          ))}
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <EmptyState title="分类榜还没有数据">首次快照入库后，分类榜会自动出现。</EmptyState>
      ) : null}
    </section>
  );
}
