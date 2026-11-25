import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { ComparePlugin, CompareResponse } from '../types';
import { CompareChart } from '../components/CompareChart';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { formatDelta, formatNumber } from '../lib/format';

function growth(plugin: ComparePlugin): number | null {
  const first = plugin.series[0];
  const last = plugin.series[plugin.series.length - 1];
  if (!first || !last || first.stars <= 0 || plugin.series.length < 2) return null;
  return (last.stars - first.stars) / first.stars;
}

export default function Compare() {
  const [params] = useSearchParams();
  const slugs = useMemo(
    () =>
      (params.get('slugs') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [params],
  );
  useTitle('插件对比');
  const invalid = slugs.length < 2 || slugs.length > 5;
  const { data, error, loading } = useApi<CompareResponse>(
    () => (invalid ? Promise.reject(new Error('needs 2-5 slugs')) : api.compare(slugs)),
    [slugs.join(',')],
  );

  if (invalid) {
    return (
      <EmptyState title="选择 2-5 个插件再对比">
        从插件库勾选，或在插件详情页点「加入对比」。也可以直接在地址栏写{' '}
        <code className="fg-body">/compare?slugs=a,b</code>。
        <div className="mt-4">
          <Link to="/plugins" className="btn btn-solid">
            去插件库挑选
          </Link>
        </div>
      </EmptyState>
    );
  }

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading rows={4} />;

  const plugins = data.plugins;

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="fs-3xl fw-semibold mb-1">插件对比</h1>
        <p className="fs-sm fg-secondary mb-0">
          {plugins.length} 个插件 · 近 {data.days} 天 · 截至 {data.as_of ?? '—'}。缺失的快照日留空，不插值。
        </p>
      </div>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-sm text-uppercase fg-secondary fw-semibold mb-3">STAR 曲线</h2>
          <CompareChart plugins={plugins} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="fs-xs text-uppercase fg-secondary">
              <tr>
                <th className="px-4 py-3 fw-medium">插件</th>
                <th className="px-2 py-3 text-end fw-medium" style={{ width: 'calc(var(--s-8) * 2 - var(--s-2))' }}>
                  当前 STAR
                </th>
                <th className="px-2 py-3 text-end fw-medium" style={{ width: 'calc(var(--s-8) + var(--s-4))' }}>
                  最新增量
                </th>
                <th className="px-2 py-3 text-end fw-medium" style={{ width: 'calc(var(--s-8) + var(--s-4))' }}>
                  区间涨幅
                </th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => {
                const last = plugin.series[plugin.series.length - 1];
                const gain = growth(plugin);
                return (
                  <tr key={plugin.slug}>
                    <td className="px-4 py-3">
                      <Link to={`/plugins/${plugin.slug}`} className="fw-medium text-decoration-none">
                        {plugin.name}
                      </Link>
                      <div className="text-truncate fs-xs fg-secondary">{plugin.slug}</div>
                    </td>
                    <td className="num px-2 py-3 text-end">{formatNumber(last?.stars ?? null)}</td>
                    <td className="num px-2 py-3 text-end">
                      <span className={(last?.delta ?? 0) > 0 ? 'fg-success' : 'fg-secondary'}>
                        {formatDelta(last?.delta ?? null)}
                      </span>
                    </td>
                    <td className="num px-2 py-3 text-end">
                      {gain === null ? '—' : `${(gain * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="fs-xs fg-secondary mb-0">
        想加入更多曲线？去 <Link to="/plugins" className="text-decoration-none">插件库</Link>{' '}
        或在插件详情页点「加入对比」。
      </p>
    </div>
  );
}
