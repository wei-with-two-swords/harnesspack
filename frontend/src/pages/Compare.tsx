import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { ComparePlugin, CompareResponse } from '../types';
import { CompareChart } from '../components/CompareChart';
import { ComparePicker } from '../components/ComparePicker';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { formatDelta, formatNumber } from '../lib/format';

function growth(plugin: ComparePlugin): number | null {
  const first = plugin.series[0];
  const last = plugin.series[plugin.series.length - 1];
  if (!first || !last || first.stars <= 0 || plugin.series.length < 2) return null;
  return (last.stars - first.stars) / first.stars;
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const slugs = useMemo(
    () =>
      (params.get('slugs') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [params],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  useTitle('插件对比');
  const invalid = slugs.length < 2 || slugs.length > 5;
  const { data, error, loading } = useApi<CompareResponse>(
    () => (invalid ? Promise.reject(new Error('needs 2-5 slugs')) : api.compare(slugs)),
    [slugs.join(',')],
  );

  const apply = (next: string[]) => {
    setParams({ slugs: next.join(',') });
    setPickerOpen(false);
  };

  const picker = (
    <ComparePicker
      open={pickerOpen}
      initialSlugs={slugs}
      onClose={() => setPickerOpen(false)}
      onApply={apply}
    />
  );

  if (invalid) {
    return (
      <>
        <EmptyState title="选择 2-5 个插件再对比">
          点击下方按钮，搜索并勾选你想对比的插件即可。
          <div className="mt-4">
            <button type="button" className="btn btn-solid" onClick={() => setPickerOpen(true)}>
              <Search className="icon-leading" aria-hidden="true" />
              搜索插件
            </button>
          </div>
        </EmptyState>
        {picker}
      </>
    );
  }

  if (error) {
    return (
      <>
        <ErrorState error={error} />
        {picker}
      </>
    );
  }
  if (loading || !data) {
    return (
      <>
        <Loading rows={4} />
        {picker}
      </>
    );
  }

  const plugins = data.plugins;

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <h1 className="fs-3xl fw-semibold mb-1">插件对比</h1>
          <p className="fs-sm fg-secondary mb-0">
            {plugins.length} 个插件 · 近 {data.days} 天 · 截至 {data.as_of ?? '—'}。缺失的快照日留空，不插值。
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPickerOpen(true)}>
          <Search className="icon-leading" aria-hidden="true" />
          添加 / 更换插件
        </button>
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
        想调整对比对象？点上方「添加 / 更换插件」搜索即可。
      </p>
      {picker}
    </div>
  );
}
