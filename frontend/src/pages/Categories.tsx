import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { CategoriesResponse } from '../types';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { categoryLabel, formatCompact, formatNumber } from '../lib/format';
import { categoryDescription } from '../lib/i18n';

export default function Categories() {
  useTitle('分类', '按 awesome-dsh-plugin 的 23 个分类分别排名，只统计在册的 DSH 插件。');
  const { data, error, loading } = useApi<CategoriesResponse>(api.categories, []);

  return (
    <section>
      <div className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-1">分类</h1>
        <p className="fs-sm fg-secondary mb-0" style={{ maxWidth: '42rem' }}>
          分类沿用 awesome-dsh-plugin 清单的 23 个分类，每个分类单独按 STAR 排名，只统计在册的 DSH 插件。
        </p>
      </div>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading rows={3} /> : null}

      {data && data.items.length > 0 ? (
        <div className="row g-4">
          {data.items.map((item) => (
            <div key={item.category} className="col-12 sm:col-6 lg:col-4">
              <Link
                to={`/rankings/category/${encodeURIComponent(item.category)}`}
                title={categoryDescription('zh', item.category)}
                className="card h-100 text-decoration-none hp-hover"
              >
                <div className="card-body">
                  <div className="d-flex align-items-baseline justify-content-between">
                    <h2 className="fs-lg fw-semibold mb-0">{categoryLabel(item.category)}</h2>
                    <span className="num fs-xs fg-secondary">{item.count} 个插件</span>
                  </div>
                  <div className="num fs-sm mt-1">{formatNumber(item.total_stars)} STAR</div>
                  <ol className="list-unstyled mt-3 pt-3 border-top mb-0">
                    {item.top.map((entry) => (
                      <li
                        key={entry.slug}
                        className="d-flex align-items-center justify-content-between gap-2 fs-sm mt-1"
                      >
                        <span className="text-truncate fg-secondary">{entry.name}</span>
                        <span className="num flex-shrink-0">{formatCompact(entry.stars)}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 fs-sm fg-info">查看 {categoryLabel(item.category)} →</div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <EmptyState title="分类还没有数据">首次快照入库后，分类会自动出现。</EmptyState>
      ) : null}
    </section>
  );
}
