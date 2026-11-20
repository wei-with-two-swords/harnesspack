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
        <code className="text-body">/compare?slugs=a,b</code>。
        <div className="mt-4">
          <Link to="/plugins" className="btn">
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">插件对比</h1>
        <p className="mt-1 text-sm text-muted">
          {plugins.length} 个插件 · 近 {data.days} 天 · 截至 {data.as_of ?? '—'}。缺失的快照日留空，不插值。
        </p>
      </div>

      <section className="card card-pad">
        <h2 className="section-title mb-3">Star 曲线</h2>
        <CompareChart plugins={plugins} />
      </section>

      <section className="card overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">插件</th>
              <th className="w-28 px-2 py-3 text-right font-medium">当前 Star</th>
              <th className="w-24 px-2 py-3 text-right font-medium">最新增量</th>
              <th className="w-24 px-2 py-3 text-right font-medium">区间涨幅</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {plugins.map((plugin) => {
              const last = plugin.series[plugin.series.length - 1];
              const gain = growth(plugin);
              return (
                <tr key={plugin.slug} className="hover:bg-raise/40">
                  <td className="px-4 py-3">
                    <Link to={`/plugins/${plugin.slug}`} className="font-medium text-white hover:text-teal">
                      {plugin.name}
                    </Link>
                    <div className="truncate text-xs text-muted">{plugin.slug}</div>
                  </td>
                  <td className="num px-2 py-3 text-right text-body">{formatNumber(last?.stars ?? null)}</td>
                  <td className="num px-2 py-3 text-right">
                    <span className={(last?.delta ?? 0) > 0 ? 'text-rise' : 'text-muted'}>
                      {formatDelta(last?.delta ?? null)}
                    </span>
                  </td>
                  <td className="num px-2 py-3 text-right text-body">
                    {gain === null ? '—' : `${(gain * 100).toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-muted">
        想加入更多曲线？去 <Link to="/plugins" className="text-teal hover:underline">插件库</Link>{' '}
        或在插件详情页点「加入对比」。
      </p>
    </div>
  );
}
