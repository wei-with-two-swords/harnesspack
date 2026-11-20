import { useMemo, useState } from 'react';
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

const ISSUE_URL =
  'https://github.com/wei-with-two-swords/harnesspack/issues/new?labels=data&title=';

export default function PluginDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [days, setDays] = useState(90);
  const [selected, setSelected] = useState<string[]>([]);
  const detail = useApi<Detail>(() => api.plugin(slug), [slug]);
  const series = useApi<SeriesResponse>(() => api.series(slug, days), [slug, days]);
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

  const togglePeer = (peerSlug: string) => {
    setSelected((current) =>
      current.includes(peerSlug)
        ? current.filter((s) => s !== peerSlug)
        : current.length >= 4
          ? current
          : [...current, peerSlug],
    );
  };
  const compareSlugs = [slug, ...selected];
  const compareHref = `/compare?slugs=${encodeURIComponent(compareSlugs.join(','))}`;

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

      {data.status === 'exited' ? (
        <div className="card card-pad border-gold/40 bg-gold/5 text-sm">
          <span className="font-medium text-gold">已退出榜单</span>
          <span className="ml-2 text-muted">
            {data.exit_reason ?? '已从上游清单移除'}
            {data.exited_at ? `（${formatDate(data.exited_at)}）` : ''}。历史曲线保留在下方，不再参与排名。
          </span>
        </div>
      ) : null}

      {!data.available ? (
        <div className="card card-pad border-fall/40 bg-fall/5 text-sm">
          <span className="font-medium text-fall">最近一次快照中该仓库不可用</span>
          <span className="ml-2 text-muted">
            可能已删除或改名；我们不会用旧值冒充新值，历史数据仍保留。
          </span>
        </div>
      ) : null}

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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">Star 曲线</h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-line text-xs">
              {[30, 90].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={`px-2.5 py-1 transition ${
                    days === value ? 'bg-raise text-white' : 'text-muted hover:text-white'
                  }`}
                >
                  近 {value} 天
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">截至 {formatDate(data.as_of)}</span>
          </div>
        </div>
        {series.loading ? <Loading rows={1} /> : <StarsChart points={points} />}
        {points.length === 1 ? (
          <p className="mt-2 text-xs text-muted">首日只有基线，明日快照后开始计算日增量。</p>
        ) : null}
      </section>

      {data.peers.length > 0 ? (
        <section className="card card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">同分类对比</h2>
            <Link to={compareHref} className="btn text-xs">
              对比已选 {compareSlugs.length} 个
            </Link>
          </div>
          <ul className="divide-y divide-line/60 text-sm">
            {data.peers.map((peer) => {
              const checked = selected.includes(peer.slug);
              return (
                <li key={peer.slug} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePeer(peer.slug)}
                    className="h-4 w-4 shrink-0 accent-[#4cc9f0]"
                    aria-label={`对比 ${peer.name}`}
                  />
                  <span className="num w-10 shrink-0 text-xs text-muted">#{peer.rank}</span>
                  <Link
                    to={`/plugins/${peer.slug}`}
                    className="min-w-0 flex-1 truncate text-body hover:text-teal"
                  >
                    {peer.name}
                  </Link>
                  <span className="num shrink-0 text-muted">{formatNumber(peer.stars)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            勾选最多 4 个同类插件，与当前插件一起对比（曲线可叠加 2-5 条）。
          </p>
        </section>
      ) : null}

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
            <div className="flex justify-between gap-4">
              <dt className="text-muted">最新快照</dt>
              <dd className="num text-body">{formatDate(data.stars_at)}</dd>
            </div>
          </dl>
        </div>
        <div className="card card-pad">
          <h2 className="section-title mb-2">数据口径</h2>
          <p className="text-xs leading-relaxed text-muted">
            Star 数取自 GitHub 公开 API；本站自 2026-11-19 起每日 UTC 00:10
            快照一次，不回溯历史。标「异常」的单日涨幅仍有记录，但会在增速统计中单独说明。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={data.url} target="_blank" rel="noreferrer noopener" className="btn">
              打开 GitHub 仓库
            </a>
            <a
              href={`${ISSUE_URL}${encodeURIComponent(`[数据] ${data.owner}/${data.repo}`)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn"
            >
              数据有误 / 申诉
            </a>
          </div>
          <p className="mt-2 text-xs text-muted">
            收录标准见 <Link to="/about/rules" className="text-teal hover:underline">收录规则</Link>
            ，接口说明见 <Link to="/about/api" className="text-teal hover:underline">API</Link>。
          </p>
        </div>
      </section>
    </div>
  );
}
