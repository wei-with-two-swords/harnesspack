import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { CategoriesResponse, Dashboard, RankingItem } from '../types';
import { StatCard } from '../components/StatCard';
import { DeltaBadge } from '../components/DeltaBadge';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { categoryLabel, formatCompact, formatDate, formatDelta, formatNumber } from '../lib/format';

function MiniList({ items, empty }: { items: RankingItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <ol className="divide-y divide-line/60">
      {items.map((item, index) => (
        <li key={item.slug}>
          <Link
            to={`/plugins/${item.slug}`}
            className="flex items-center gap-3 py-2.5 transition hover:text-teal"
          >
            <span className="num w-6 text-center text-sm text-muted">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{item.name}</span>
              <span className="block truncate text-xs text-muted">
                {item.owner}/{item.repo}
              </span>
            </span>
            <span className="num text-sm text-body">{formatNumber(item.stars)}</span>
            <span className="hidden w-24 text-right text-xs sm:block">
              <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  const { data, error, loading } = useApi<Dashboard>(api.dashboard, []);
  const { data: categories } = useApi<CategoriesResponse>(api.categories, []);

  return (
    <>
      <section className="mb-8">
        <div className="pill mb-3">DSH PLUGINS · DAILY SNAPSHOT</div>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
          500 个 DSH 插件，<span className="text-teal">真实 star 增速</span>的竞速场
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          只收录可安装进 DeepSeek Harness（DSH）的插件。每天 00:10 UTC 抓取一次 GitHub
          star，只展示可核对的数字：不回填、不美化、异常单独标注。
        </p>
        {data?.as_of ? (
          <div className="mt-3 text-xs text-muted">
            数据截至 <span className="text-body">{formatDate(data.as_of)}</span>
          </div>
        ) : null}
      </section>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading rows={2} /> : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="收录插件" value={formatNumber(data.kpis.tracked)} hint="在册上限 500" />
            <StatCard
              label="总 Star"
              value={formatCompact(data.kpis.total_stars)}
              hint={`今日净增 ${formatDelta(data.kpis.stars_delta)}`}
            />
            <StatCard
              label="快照天数"
              value={formatNumber(data.kpis.snapshots)}
              hint="自 2026-11-19 起"
            />
            <StatCard
              label="今日入库"
              value={formatNumber(data.kpis.new_today)}
              hint="按首次观测计"
            />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="card card-pad">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="section-title">竞速榜</h2>
                <Link className="text-xs text-teal hover:underline" to="/rankings/velocity">
                  查看全部 →
                </Link>
              </div>
              <p className="mb-2 text-xs text-muted">今日新增 star（相邻快照差）</p>
              <MiniList
                items={data.top_velocity}
                empty="数据积累中：首次快照已入库，明天开始计算单日增量"
              />
            </div>

            <div className="card card-pad">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="section-title">总榜</h2>
                <Link className="text-xs text-teal hover:underline" to="/rankings/total">
                  查看全部 →
                </Link>
              </div>
              <p className="mb-2 text-xs text-muted">当前 star 总量 · 并列按名称排序</p>
              <MiniList items={data.top_total} empty="暂无数据" />
            </div>
          </section>

          <section className="card card-pad mt-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="section-title">新秀</h2>
              <Link className="text-xs text-teal hover:underline" to="/rankings/rookie">
                查看全部 →
              </Link>
            </div>
            <p className="mb-2 text-xs text-muted">仓库创建于 30 天内、且已进入收录名单</p>
            <MiniList items={data.newest} empty="名单内暂无 30 天内新建的仓库" />
          </section>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">分类榜</h2>
              <Link className="text-xs text-teal hover:underline" to="/categories">
                全部分类 →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(categories?.items ?? []).slice(0, 6).map((item) => (
                <Link
                  key={item.category}
                  to={`/rankings/category/${encodeURIComponent(item.category)}`}
                  className="card px-4 py-3 transition hover:border-teal/40"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-white">
                      {categoryLabel(item.category)}榜
                    </span>
                    <span className="num text-xs text-muted">{item.count} 个</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {item.top.map((entry) => entry.name).join(' · ') || '暂无数据'}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-4 flex flex-col gap-3 rounded-xl border border-gold/25 bg-gold/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-gold">本周编辑精选 · 招商中</div>
              <p className="mt-1 text-xs text-muted">
                推荐位独立成块、明确标注「赞助」，不参与任何榜单排名，也不影响收录资格。
              </p>
            </div>
            <Link className="btn shrink-0" to="/sponsors">
              了解推荐位
            </Link>
          </section>

          <p className="mt-6 text-xs leading-relaxed text-muted">
            数据口径：star 来自 GitHub 公开 API 的 stargazers_count；每日 UTC 00:10
            快照一次，缺日不补。单日增量超过近 7 日均值 5 倍且缺乏合理解释的，标记为「异常」但不删除数据。
          </p>
        </>
      ) : null}
    </>
  );
}
