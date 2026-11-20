import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { CategoriesResponse, Dashboard, RankingItem } from '../types';
import { StatCard } from '../components/StatCard';
import { DeltaBadge } from '../components/DeltaBadge';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { categoryLabel, formatCompact, formatDate, formatDelta, formatNumber } from '../lib/format';

const SECTION_TITLE = 'fs-sm text-uppercase fg-secondary fw-semibold mb-0';
const LINK = 'text-decoration-none';

function MiniList({ items, empty }: { items: RankingItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <ol className="list-unstyled mb-0">
      {items.map((item, index) => (
        <li key={item.slug} className="border-bottom">
          <Link to={`/plugins/${item.slug}`} className="d-flex align-items-center gap-3 py-2 text-decoration-none">
            <span className="num flex-shrink-0 text-center fs-sm fg-secondary" style={{ width: '1.5rem' }}>
              {index + 1}
            </span>
            <span className="min-w-0 flex-grow-1">
              <span className="d-block text-truncate fs-sm fw-medium">{item.name}</span>
              <span className="d-block text-truncate fs-xs fg-secondary">
                {item.owner}/{item.repo}
              </span>
            </span>
            <span className="num fg-body flex-shrink-0 fs-sm">{formatNumber(item.stars)}</span>
            <span className="d-none sm:d-block flex-shrink-0 text-end fs-xs" style={{ width: '6rem' }}>
              <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  useTitle(undefined, 'HarnessPack：DSH 插件 star 竞速榜，每天一次真实快照，不美化、不回填。');
  const { data, error, loading } = useApi<Dashboard>(api.dashboard, []);
  const { data: categories } = useApi<CategoriesResponse>(api.categories, []);

  return (
    <>
      <section className="mb-4 lg:mb-5">
        <div className="badge theme-secondary badge-subtle mb-3">DSH PLUGINS · DAILY SNAPSHOT</div>
        <h1 className="fs-4xl fw-semibold text-balance" style={{ maxWidth: '42rem' }}>
          {data ? formatNumber(data.kpis.tracked) : '上万'} 个 DSH 插件，
          <span className="fg-info">真实 star 增速</span>的竞速场
        </h1>
        <p className="mt-3 fs-sm fg-secondary" style={{ maxWidth: '42rem' }}>
          名单与分类来自 awesome-dsh-plugin 精选清单，只收录可安装进 DeepSeek Harness（DSH）的插件。
          每天 00:10 UTC 抓取一次 GitHub star，只展示可核对的数字：不回填、不美化、异常单独标注。
        </p>
        {data?.as_of ? (
          <div className="mt-3 fs-xs fg-secondary">
            数据截至 <span>{formatDate(data.as_of)}</span>
          </div>
        ) : null}
      </section>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading rows={2} /> : null}

      {data ? (
        <>
          <section className="row g-3">
            <div className="col-6 lg:col-3">
              <StatCard label="收录插件" value={formatNumber(data.kpis.tracked)} hint="来自 awesome-dsh-plugin 清单" />
            </div>
            <div className="col-6 lg:col-3">
              <StatCard
                label="总 Star"
                value={formatCompact(data.kpis.total_stars)}
                hint={`今日净增 ${formatDelta(data.kpis.stars_delta)}`}
              />
            </div>
            <div className="col-6 lg:col-3">
              <StatCard label="快照天数" value={formatNumber(data.kpis.snapshots)} hint="自 2026-11-19 起" />
            </div>
            <div className="col-6 lg:col-3">
              <StatCard label="今日入库" value={formatNumber(data.kpis.new_today)} hint="按首次观测计" />
            </div>
          </section>

          <section className="row g-4 mt-1">
            <div className="col-12 lg:col-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="mb-1 d-flex align-items-center justify-content-between">
                    <h2 className={SECTION_TITLE}>竞速榜</h2>
                    <Link className={`${LINK} fs-xs`} to="/rankings/velocity">
                      查看全部 →
                    </Link>
                  </div>
                  <p className="mb-2 fs-xs fg-secondary">今日新增 star（相邻快照差）</p>
                  <MiniList
                    items={data.top_velocity}
                    empty="数据积累中：首次快照已入库，明天开始计算单日增量"
                  />
                </div>
              </div>
            </div>

            <div className="col-12 lg:col-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="mb-1 d-flex align-items-center justify-content-between">
                    <h2 className={SECTION_TITLE}>总榜</h2>
                    <Link className={`${LINK} fs-xs`} to="/rankings/total">
                      查看全部 →
                    </Link>
                  </div>
                  <p className="mb-2 fs-xs fg-secondary">当前 star 总量 · 并列按名称排序</p>
                  <MiniList items={data.top_total} empty="暂无数据" />
                </div>
              </div>
            </div>
          </section>

          <section className="card mt-4">
            <div className="card-body">
              <div className="mb-1 d-flex align-items-center justify-content-between">
                <h2 className={SECTION_TITLE}>新秀</h2>
                <Link className={`${LINK} fs-xs`} to="/rankings/rookie">
                  查看全部 →
                </Link>
              </div>
              <p className="mb-2 fs-xs fg-secondary">仓库创建于 30 天内、已进入收录名单且 star ≥ 10</p>
              <MiniList items={data.newest} empty="名单内暂无 30 天内新建的仓库" />
            </div>
          </section>

          <section className="mt-4">
            <div className="mb-2 d-flex align-items-center justify-content-between">
              <h2 className={SECTION_TITLE}>分类榜</h2>
              <Link className={`${LINK} fs-xs`} to="/categories">
                全部分类 →
              </Link>
            </div>
            <div className="row g-3">
              {(categories?.items ?? []).slice(0, 6).map((item) => (
                <div key={item.category} className="col-12 sm:col-6 lg:col-4">
                  <Link
                    to={`/rankings/category/${encodeURIComponent(item.category)}`}
                    className="card h-100 text-decoration-none"
                  >
                    <div className="card-body py-3">
                      <div className="d-flex align-items-baseline justify-content-between">
                        <span className="fs-sm fw-medium">{categoryLabel(item.category)}榜</span>
                        <span className="num fs-xs fg-secondary">{item.count} 个</span>
                      </div>
                      <div className="mt-1 text-truncate fs-xs fg-secondary">
                        {item.top.map((entry) => entry.name).join(' · ') || '暂无数据'}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="card border-warning bg-subtle-warning mt-4">
            <div className="card-body d-flex flex-column sm:flex-row sm:align-items-center justify-content-between gap-3">
              <div>
                <div className="fs-sm fw-medium fg-emphasis-warning">本周编辑精选 · 招商中</div>
                <p className="mt-1 mb-0 fs-xs fg-secondary">
                  推荐位独立成块、明确标注「赞助」，不参与任何榜单排名，也不影响收录资格。
                </p>
              </div>
              <Link className="btn btn-solid theme-warning flex-shrink-0" to="/sponsors">
                了解推荐位
              </Link>
            </div>
          </section>

          <p className="mt-4 mb-0 fs-xs fg-secondary">
            数据口径：star 来自 GitHub 公开 API 的 stargazers_count；每日 UTC 00:10
            快照一次，缺日不补。单日增量超过近 7 日均值 5 倍且缺乏合理解释的，标记为「异常」但不删除数据。
          </p>
        </>
      ) : null}
    </>
  );
}
