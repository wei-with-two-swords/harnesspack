import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { PluginDetail as Detail, SeriesResponse } from '../types';
import { StarsChart } from '../components/StarsChart';
import { DeltaBadge } from '../components/DeltaBadge';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { formatDate, formatDelta, formatNumber } from '../lib/format';

function RankChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-line bg-surface/70 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 text-lg ${value === null ? 'text-muted' : 'text-white'}`}>
        {value === null ? '—' : `#${value}`}
      </div>
    </div>
  );
}

export default function PluginDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const detail = useApi<Detail>(() => api.plugin(slug), [slug]);
  const series = useApi<SeriesResponse>(() => api.series(slug, 90), [slug]);
  const points = useMemo(() => series.data?.items ?? [], [series.data]);
  const data = detail.data;
  useTitle(data ? `${data.name} · ${data.owner}/${data.repo}` : '插件详情', data?.description ?? undefined);

  if (detail.error) {
    const err = detail.error;
    return (
      <div className="space-y-4">
        <Link to="/rankings/total" className="text-sm text-teal hover:underline">
          ← 返回总榜
        </Link>
        {err.message.includes('404') ? (
          <EmptyState title="没有找到这个插件">它可能已被移出名单，或链接有误。</EmptyState>
        ) : (
          <ErrorState error={err} />
        )}
      </div>
    );
  }

  if (detail.loading || !data) return <Loading rows={4} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link to="/rankings/total" className="text-teal hover:underline">
          ← 返回榜单
        </Link>
        <span>/</span>
        <span>{data.harness ?? 'harness'}</span>
        <span>/</span>
        <span>{data.category ?? '未分类'}</span>
      </div>

      <section className="card card-pad">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white">{data.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-teal hover:underline"
              >
                {data.owner}/{data.repo}
              </a>
              {data.category ? <span className="pill">{data.category}</span> : null}
              {data.harness ? <span className="pill">{data.harness}</span> : null}
              {data.archived ? <span className="pill border-fall/40 text-fall">已归档</span> : null}
              {data.status !== 'active' ? <span className="pill">{data.status}</span> : null}
            </div>
            {data.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{data.description}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs uppercase tracking-widest text-muted">Star</div>
            <div className="num text-3xl font-semibold text-white">{formatNumber(data.stars)}</div>
            <div className="mt-1 text-sm">
              <DeltaBadge value={data.delta} anomaly={data.is_anomaly} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <RankChip label="总榜" value={data.rank_total} />
          <RankChip label="竞速" value={data.rank_velocity} />
          <RankChip label="7 日增速" value={data.rank_growth7} />
          <RankChip label="7 日黑马" value={data.rank_darkhorse7} />
        </div>
      </section>

      <section className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Star 曲线</h2>
          <span className="text-xs text-muted">
            近 90 天 · 截至 {formatDate(data.as_of)}
          </span>
        </div>
        {series.loading ? <Loading rows={1} /> : <StarsChart points={points} />}
        {points.length === 1 ? (
          <p className="mt-2 text-xs text-muted">
            首日只有基线，明日快照后开始计算日增量。
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card card-pad">
          <h2 className="section-title mb-2">收录信息</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">收录日期</dt>
              <dd className="num text-body">{formatDate(data.added_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">仓库创建</dt>
              <dd className="num text-body">{formatDate(data.repo_created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">最新日增量</dt>
              <dd className="num text-body">{formatDelta(data.delta)}</dd>
            </div>
          </dl>
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-2">数据口径</h2>
          <p className="text-xs leading-relaxed text-muted">
            Star 数取自 GitHub 公开 API；本站自 2026-11-19 起每日 UTC 00:10
            快照一次，不回溯历史。标「异常」的单日涨幅仍有记录，但会在增速统计中单独说明。
          </p>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer noopener"
            className="btn mt-3"
          >
            打开 GitHub 仓库
          </a>
        </div>
      </section>
    </div>
  );
}
