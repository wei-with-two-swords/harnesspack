import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useTitle } from '../lib/useTitle';

const BOARDS = [
  ['近 24 小时', '最近 24 小时新增 STAR：相邻两个快照的差值，越大越靠前。'],
  ['区间增速', '近 7 / 30 天涨幅：(当前 - 基准) / 基准，基准日 STAR 需 ≥ 50。'],
  ['总榜', '当前 STAR 总量；并列按名称升序。'],
  ['名次', '近 7 天总榜名次的跃升幅度。'],
  ['最新', '收录名单内、仓库创建时间在最近 30 天、且 STAR ≥ 10 的项目。'],
  ['稳健', '近 30 天剔除异常单日涨幅后，按剩余天数的日均新增排序；至少 3 天样本。'],
  ['NPM', '按 npm registry 近 1 年 / 年至今 / 24 小时 / 7 天 / 30 天的包下载量排序；STAR 仅作对照，不参与计算。'],
];

const LINK = 'text-decoration-none';

export default function DataMethods() {
  useTitle('数据口径', 'HarnessPack 的数据来源、更新时间、榜单算法与免责声明。');
  return (
    <article className="fs-sm" style={{ maxWidth: 'var(--measure-wide)' }}>
      <header className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-2">数据口径</h1>
        <p className="mb-0 fg-secondary">
          HarnessPack 只做一件事：把 DeepSeek Harness 插件的 STAR 变化如实记录下来，并让增速可比。
        </p>
      </header>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">数据从哪来</h2>
          <p className="mt-2 fg-secondary">
            名单与分类来自{' '}
            <a className={LINK} href="https://awesome-dsh-plugin.com" target="_blank" rel="noreferrer">
              awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
            </a>{' '}
            精选清单（CC0-1.0，约 1.1 万个仓库）：
            上游要求仓库必须能通过 <code>dsh plugin add</code> 安装（package.json 含 <code>dsh.bundle</code>），
            DSH 本体、桌面客户端、纯收录清单与跨 harness 应用不在范围内。
          </p>
          <p className="mt-3 fg-secondary">
            全部数字来自 GitHub 公开 API 的 <code className="num">stargazerCount</code>。
            每天 UTC 00:10 由 GitHub Actions 批量抓取一次并提交快照，站点只读这些快照，不临场请求 GitHub。
          </p>
          <p className="mt-3 mb-0 fg-secondary">
            快照自 2026-11-19 开始，不做历史回填。快照少于 2 天时显示「数据积累中」——这是产品规则，不是 bug。
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">榜单怎么算</h2>
          <dl className="mt-3 mb-0">
            {BOARDS.map(([name, desc]) => (
              <div key={name} className="d-flex gap-4 py-2 border-bottom">
                <dt className="flex-shrink-0 fw-medium fg-warning" style={{ width: 'var(--s-7)' }}>
                  {name}
                </dt>
                <dd className="mb-0 fg-secondary">{desc}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 mb-0 fs-xs fg-secondary">
            所有榜单只统计「在册且状态为 active」的仓库；缺快照的日子不参与计算，也不会用插值补。
            分类沿用上游清单的 23 个分类，只在同一分类内重新排名。
            稳健先剔除被标为异常的单日涨幅，再按剩余 30 天的日均新增排序，至少 3 天样本才入榜；
            覆盖率与失败清单见 <Link className={LINK} to="/status">数据状态</Link>。
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">NPM 榜的口径</h2>
          <p className="mt-2 fg-secondary">
            NPM 榜是<strong>独立副榜</strong>，数据与 STAR 完全分开：包名来自仓库内的 package.json 与 npm registry 交叉校验，
            下载量来自 npm 官方 <code>api.npmjs.org/downloads</code>，每天抓取并保留逐日归档，不做回填。
          </p>
          <p className="mt-3 fg-secondary">
            这是 <code>tarball</code> 下载数，包含 CI、镜像、依赖传递与重复下载，
            <strong>不是用户安装数</strong>。只统计能映射出 npm 包的在册插件，约 6,900 个；
            没有 npm 包的插件不进入本榜，也不按 0 下载处理。
          </p>
          <p className="mt-3 mb-0 fs-xs fg-secondary">
            下载量与 STAR 衡量的是不同维度，页面并列展示仅为对照，从不相加或混算成综合分。
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">收录与退出</h2>
          <p className="mt-2 fg-secondary">
            名单与分类直接采用 awesome-dsh-plugin 精选清单（CC0-1.0）：作者在该仓库提 PR，合并后我们每日同步，
            按仓库去重（同一仓库的多个子包只计一次），不重复做人工评审。
          </p>
          <ul className="mt-3 mb-0 ps-4 fg-secondary">
            <li className="mb-1">收录：上游合并即进入名单，次日快照开始计 STAR；分类沿用上游的 23 个分类。</li>
            <li className="mb-1">退出：上游删除、仓库 404 / 归档、90 天无 push 且 STAR 无净增长，标记退出并保留历史曲线，不 404。</li>
            <li className="mb-1">变更：每次同步写入仓库 changelog，可审计；退出后重新被收录会自动恢复。</li>
            <li>
              提交收录请去{' '}
              <a className={LINK} href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin" target="_blank" rel="noreferrer">
                awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
              </a>{' '}
              提 PR。
            </li>
          </ul>
          <p className="mt-3 mb-0 fs-xs fg-secondary">
            完整规则见仓库 <code>docs/收录规则.md</code>；同步变更记录在 <code>data/catalog/changelog.jsonl</code>。
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">反注水</h2>
          <p className="mt-2 mb-0 fg-secondary">
            单日增量超过近 7 日均值的 5 倍、且没有发布 / 社区事件解释时，该日标记为「异常」。
            异常数据不删除、不参与均值，页面上会显式标注。
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">更新、容错与免责</h2>
          <p className="mt-2 fg-secondary">
            抓取失败会记录在快照的 failures 里并告警；缺日不补、绝不伪造。站点只做只读展示，
            STAR 数据归 GitHub 与各仓库作者所有。本项目非 GitHub 或任何 harness 官方项目。
          </p>
          <Link to="/rankings/velocity" className="btn btn-solid mt-2">
            去看近 24 小时榜
          </Link>
        </div>
      </section>
    </article>
  );
}
