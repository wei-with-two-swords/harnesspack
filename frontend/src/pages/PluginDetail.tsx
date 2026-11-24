import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { PluginDetail as Detail, SeriesResponse } from '../types';
import { StarsChart } from '../components/StarsChart';
import { DeltaBadge } from '../components/DeltaBadge';
import { Avatar } from '../components/RankTable';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { formatCompact, formatDate, formatDateTime, formatDelta, formatNumber } from '../lib/format';
import { categoryDescription } from '../lib/i18n';

function RankChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border rounded-3 px-3 py-2">
      <div className="fs-xs fg-secondary">{label}</div>
      <div className={`num mt-1 fs-lg ${value === null ? 'fg-secondary' : ''}`}>
        {value === null ? '—' : `#${value}`}
      </div>
    </div>
  );
}

const SECTION_TITLE = 'fs-sm text-uppercase fg-secondary fw-semibold mb-0';

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
      <div className="d-flex flex-column gap-4">
        <Link to="/rankings/total" className="fs-sm text-decoration-none">
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
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap align-items-center gap-2 fs-sm fg-secondary">
        <Link to="/rankings/total" className="text-decoration-none">
          ← 返回榜单
        </Link>
        <span>/</span>
        <span>{data.harness ?? 'harness'}</span>
        <span>/</span>
        <span>{data.category ?? '未分类'}</span>
      </div>

      {data.status === 'exited' ? (
        <div className="alert theme-warning bg-subtle-warning fs-sm">
          <span className="fw-semibold fg-emphasis-warning">已退出榜单</span>
          <span className="ms-2">
            {data.exit_reason ?? '已从上游清单移除'}
            {data.exited_at ? `（${formatDate(data.exited_at)}）` : ''}。历史曲线保留在下方，不再参与排名。
          </span>
        </div>
      ) : null}

      {!data.available ? (
        <div className="alert theme-danger bg-subtle-danger fs-sm">
          <span className="fw-semibold fg-emphasis-danger">最近一次快照中该仓库不可用</span>
          <span className="ms-2">
            可能已删除或改名；我们不会用旧值冒充新值，历史数据仍保留。
          </span>
        </div>
      ) : null}

      <section className="card">
        <div className="card-body">
          <div className="d-flex flex-column sm:flex-row sm:align-items-start justify-content-between gap-4">
            <div className="min-w-0 d-flex gap-3">
              <Avatar owner={data.owner} size={64} />
              <div className="min-w-0">
                <h1 className="fs-3xl fw-semibold mb-0">{data.name}</h1>
                <div className="mt-1 d-flex flex-wrap align-items-center gap-2 fs-sm fg-secondary">
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-decoration-none"
                  >
                    {data.owner}/{data.repo}
                  </a>
                  {data.category ? (
                    <span className="badge theme-secondary badge-subtle" title={categoryDescription('zh', data.category)}>{data.category}</span>
                  ) : null}
                  {data.harness ? (
                    <span className="badge theme-secondary badge-subtle">{data.harness}</span>
                  ) : null}
                  {data.archived ? (
                    <span className="badge theme-danger badge-subtle">已归档</span>
                  ) : null}
                  {data.status !== 'active' ? (
                    <span className="badge theme-secondary badge-subtle">{data.status}</span>
                  ) : null}
                </div>
                {data.description ? (
                  <p className="mt-3 mb-0 fs-sm fg-secondary" style={{ maxWidth: '42rem' }}>
                    {data.description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex-shrink-0 sm:text-end">
              <div className="fs-xs text-uppercase fg-secondary">Star</div>
              <div className="num fs-3xl fw-semibold">{formatNumber(data.stars)}</div>
              <div className="mt-1 fs-sm">
                <DeltaBadge value={data.delta} anomaly={data.is_anomaly} />
              </div>
              <div className="mt-3 fs-xs fg-secondary">Forks</div>
              <div className="num fs-lg">{formatNumber(data.forks)}</div>
              <div className="mt-2 fs-xs fg-secondary">NPM 下载 · 近 1 年</div>
              <div className="num fs-lg">{data.npm_package ? formatCompact(data.downloads_1y) : '—'}</div>
            </div>
          </div>

          <div className="row g-2 mt-4">
            {[
              ['STAR 总榜', data.rank_total],
              ['STAR 分类', data.rank_category],
              ['近 24 小时增速', data.rank_velocity],
              ['近 7 天区间增速', data.rank_growth7],
              ['名次', data.rank_darkhorse7],
              ['稳健', data.rank_quality30],
              ['NPM 总榜', data.rank_npm_total],
              ['NPM 近 24 小时', data.rank_npm_24h],
              ['NPM 近 7 天', data.rank_npm_7d],
              ['NPM 近 30 天', data.rank_npm_30d],
              ['NPM 年至今', data.rank_npm_ytd],
            ].map(([label, value]) => (
              <div key={label as string} className="col-6 sm:col-4 lg:col-3">
                <RankChip label={label as string} value={value as number | null} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <div className="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h2 className={SECTION_TITLE}>Star 曲线</h2>
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm" role="group" aria-label="曲线区间">
                {[30, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDays(value)}
                    className={`btn ${days === value ? 'btn-solid theme-secondary active' : 'btn-outline'}`}
                    aria-pressed={days === value}
                  >
                    近 {value} 天
                  </button>
                ))}
              </div>
              <span className="fs-xs fg-secondary">截至 {formatDate(data.as_of)}</span>
            </div>
          </div>
          {series.loading ? <Loading rows={1} /> : <StarsChart points={points} />}
          {points.length === 1 ? (
            <p className="mt-2 mb-0 fs-xs fg-secondary">首日只有基线，明日快照后开始计算日增量。</p>
          ) : null}
        </div>
      </section>

      {data.peers.length > 0 ? (
        <section className="card">
          <div className="card-body">
            <div className="mb-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <h2 className={SECTION_TITLE}>同分类对比</h2>
              <Link to={compareHref} className="btn btn-outline theme-secondary btn-sm">
                对比已选 {compareSlugs.length} 个
              </Link>
            </div>
            <ul className="list-unstyled mb-0 fs-sm">
              {data.peers.map((peer) => {
                const checked = selected.includes(peer.slug);
                return (
                  <li key={peer.slug} className="d-flex align-items-center gap-3 py-2 border-bottom">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePeer(peer.slug)}
                      className="check"
                      aria-label={`对比 ${peer.name}`}
                    />
                    <span className="num flex-shrink-0 fs-xs fg-secondary" style={{ width: '2.5rem' }}>
                      #{peer.rank}
                    </span>
                    <Link
                      to={`/plugins/${peer.slug}`}
                      className="min-w-0 flex-grow-1 text-truncate text-decoration-none"
                    >
                      {peer.name}
                    </Link>
                    <span className="num flex-shrink-0 fg-secondary">{formatNumber(peer.stars)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 mb-0 fs-xs fg-secondary">
              勾选最多 4 个同类插件，与当前插件一起对比（曲线可叠加 2-5 条）。
            </p>
          </div>
        </section>
      ) : null}

      <section className="row g-4">
        <div className="col-12 sm:col-6">
          <div className="card h-100">
            <div className="card-body">
              <h2 className={`${SECTION_TITLE} mb-2`}>仓库信息</h2>
              <dl className="mb-0 fs-sm">
                {[
                  ['作者', data.owner],
                  ['仓库创建', formatDate(data.repo_created_at)],
                  ['最近推送', formatDateTime(data.pushed_at)],
                  ['默认分支', data.default_branch ?? '—'],
                  ['Fork 数', formatNumber(data.forks)],
                  ['许可证', data.license || '—'],
                  ['Topics', data.topics?.length ? data.topics.join('、') : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="d-flex justify-content-between gap-4 mb-2">
                    <dt className="fw-normal fg-secondary">{label}</dt>
                    <dd className={`num mb-0 text-end${label === 'Topics' ? '' : ' text-truncate'}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              {data.github_description && data.github_description !== data.description ? (
                <p className="mt-3 mb-0 fs-xs fg-secondary">
                  GitHub 描述：{data.github_description}
                </p>
              ) : null}
              <div className="mt-3 d-flex flex-wrap gap-2">
                <a href={data.url} target="_blank" rel="noreferrer noopener" className="btn btn-outline theme-secondary btn-sm">
                  打开 GitHub 仓库
                </a>
                <a
                  href={`https://github.com/${encodeURIComponent(data.owner)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-outline theme-secondary btn-sm"
                >
                  作者主页
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 sm:col-6">
          <div className="card h-100">
            <div className="card-body">
              <h2 className={`${SECTION_TITLE} mb-2`}>收录与数据</h2>
              <dl className="mb-0 fs-sm">
                {[
                  ['收录日期', formatDate(data.added_at)],
                  ['最新快照', formatDate(data.stars_at)],
                  ['统计基准日', formatDate(data.as_of)],
                  ['最新日增量', formatDelta(data.delta)],
                  ['状态', data.status ?? '—'],
                  ['NPM 包名', data.npm_package ?? '—'],
                  ['NPM 下载 · 近 30 天', data.npm_package ? formatCompact(data.downloads_30d) : '—'],
                  ['NPM 下载 · 近 7 天', data.npm_package ? formatCompact(data.downloads_7d) : '—'],
                  ['NPM 下载 · 近 24 小时', data.npm_package ? formatCompact(data.downloads_24h) : '—'],
                  ['NPM 下载 · 年至今', data.npm_package ? formatCompact(data.downloads_ytd) : '—'],
                  ['NPM 归档', data.npm_first_day
                    ? `${data.npm_first_day} ~ ${data.npm_last_day ?? ''}（${data.npm_days_in_archive ?? '—'} 天）`
                    : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="d-flex justify-content-between gap-4 mb-2">
                    <dt className="fw-normal fg-secondary">{label}</dt>
                    <dd className="num mb-0 text-end">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 d-flex flex-wrap gap-2">
                {data.npm_package ? (
                  <a
                    href={`https://www.npmjs.com/package/${data.npm_package}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn btn-outline theme-secondary btn-sm"
                  >
                    打开 npm 包
                  </a>
                ) : null}
                <a
                  href={`${ISSUE_URL}${encodeURIComponent(`[数据] ${data.owner}/${data.repo}`)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-outline theme-secondary btn-sm"
                >
                  数据有误 / 申诉
                </a>
              </div>
              <p className="mt-3 mb-0 fs-xs fg-secondary">
                Star 与 Fork 来自 GitHub 公开 API 的每日快照；下载量是 npm tarball 数，含 CI 与依赖，不等于用户安装数。
                收录标准见 <Link to="/about#rules" className="text-decoration-none">收录规则</Link>
                ，接口说明见 <Link to="/about/api" className="text-decoration-none">API</Link>。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
