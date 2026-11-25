import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { StatusResponse } from '../types';
import { formatDate, formatNumber, formatPercent } from '../lib/format';
import { ErrorState, Loading } from '../components/States';

const LINK = 'text-decoration-none';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card h-100">
      <div className="card-body py-3">
        <p className="fs-xs text-uppercase fg-secondary mb-0">{label}</p>
        <p className="num mt-1 mb-0 fs-2xl fw-semibold">{value}</p>
        {hint ? <p className="mt-1 mb-0 fs-xs fg-secondary">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function Status() {
  useTitle('数据状态', '公开的抓取覆盖率、失败清单与数据库计数，便于独立核对。');
  const { data, error, loading } = useApi<StatusResponse>(() => api.status(), []);
  const [showAll, setShowAll] = useState(false);

  return (
    <section className="d-flex flex-column gap-4">
      <header>
        <h1 className="fs-3xl fw-semibold mb-1">数据状态</h1>
        <p className="fs-sm fg-secondary mb-0" style={{ maxWidth: 'var(--measure)' }}>
          抓取覆盖率、失败清单与数据库计数全部公开；快照文件本身在
          <a
            className={`mx-1 ${LINK}`}
            href="https://github.com/wei-with-two-swords/harnesspack/tree/main/data/snapshots"
            target="_blank"
            rel="noreferrer"
          >
            仓库 data/snapshots
          </a>
          里，可直接下载核对。
        </p>
      </header>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}

      {data ? (
        <>
          <div className="row g-3">
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label="快照天数"
                value={formatNumber(data.snapshots.days)}
                hint={
                  data.snapshots.first_date
                    ? `自 ${data.snapshots.first_date} 起`
                    : '等待首份快照'
                }
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label="最近快照成功率"
                value={data.snapshots.ok_rate === null ? '—' : formatPercent(data.snapshots.ok_rate)}
                hint={
                  data.snapshots.latest
                    ? `${formatNumber(data.snapshots.latest.ok)} / ${formatNumber(data.snapshots.latest.total)}`
                    : '—'
                }
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label="名单覆盖率"
                value={data.snapshots.coverage === null ? '—' : formatPercent(data.snapshots.coverage)}
                hint={`名单 ${formatNumber(data.snapshots.seed_count)} 个仓库`}
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label="异常标记"
                value={formatNumber(data.database.anomalies)}
                hint="只标注，不删原始数据"
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat label="数据库插件" value={formatNumber(data.database.plugins)} hint={`活跃 ${formatNumber(data.database.active)}`} />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat label="已退出" value={formatNumber(data.database.exited)} hint="保留历史曲线" />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat label="不可用" value={formatNumber(data.database.unavailable)} hint="最近快照 404" />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat label="STAR 记录" value={formatNumber(data.database.stars_rows)} hint={`截至 ${data.database.as_of ?? '—'}`} />
            </div>
          </div>

          {data.snapshots.latest ? (
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2">
                  <h2 className="fs-lg fw-semibold mb-0">最近一次抓取</h2>
                  <p className="num fs-xs fg-secondary mb-0">
                    {data.snapshots.latest.date} · 耗时 {data.snapshots.latest.elapsed_s ?? '—'}s
                    {data.last_catalog_sync
                      ? ` · 名单同步 ${data.last_catalog_sync.at.slice(0, 16).replace('T', ' ')}`
                      : ''}
                  </p>
                </div>
                <p className="mt-2 mb-0 fs-sm fg-secondary">
                  {formatNumber(data.snapshots.latest.ok)} 个仓库成功，{formatNumber(data.snapshots.latest.failed)} 个失败；
                  失败的仓库会被记录但不会从榜单消失，详情页会说明「最近一次快照不可用」。
                </p>
                {data.last_catalog_sync ? (
                  <p className="mt-1 mb-0 fs-sm fg-secondary">
                    最近一次名单同步：新增 {data.last_catalog_sync.added}、移除 {data.last_catalog_sync.removed}、变更{' '}
                    {data.last_catalog_sync.changed}。
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {data.snapshots.failures.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="d-flex align-items-center justify-content-between border-bottom px-4 py-3">
                <h2 className="fs-lg fw-semibold mb-0">失败清单（最多显示 50 条）</h2>
                {data.snapshots.failures.length > 10 ? (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="btn btn-text btn-sm"
                  >
                    {showAll ? '收起' : `展开全部 ${data.snapshots.failures.length} 条`}
                  </button>
                ) : null}
              </div>
              <ul className="list-unstyled mb-0 fs-sm">
                {(showAll ? data.snapshots.failures : data.snapshots.failures.slice(0, 10)).map((f) => (
                  <li key={f.slug} className="d-flex align-items-center justify-content-between gap-3 px-4 py-2 border-bottom">
                    <span className="text-truncate">
                      <span>{f.repo}</span>
                      <span className="ms-2 fs-xs fg-secondary">{f.slug}</span>
                    </span>
                    <span className="flex-shrink-0 fs-xs fg-danger">{f.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="fs-xs fg-secondary mb-0">
            口径说明见 <Link className={LINK} to="/about">数据口径</Link>；
            发现异常可在 <Link className={LINK} to="/about#submit">提交插件</Link> 页发起申诉。
            {data.snapshots.as_of ? ` 数据截至 ${formatDate(data.snapshots.as_of)}。` : ''}
          </p>
        </>
      ) : null}
    </section>
  );
}
