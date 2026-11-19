import { Link } from 'react-router-dom';

const BOARDS = [
  ['竞速', '当日新增 star：相邻两个快照的差值，越大越靠前。'],
  ['增速', '近 7 / 30 天涨幅：(当前 - 基准) / 基准，基准日 star 需 ≥ 50。'],
  ['总榜', '当前 star 总量；并列按名称升序。'],
  ['黑马', '区间内总榜名次的跃升幅度。'],
  ['新秀', '收录名单内、仓库创建时间在最近 30 天的项目。'],
];

export default function About() {
  return (
    <article className="prose-invert max-w-3xl space-y-6 text-sm leading-relaxed text-body">
      <header>
        <h1 className="text-2xl font-semibold text-white">数据口径与收录规则</h1>
        <p className="mt-2 text-muted">
          HarnessRank 只做一件事：把 harness 扩展的 star 变化如实记录下来，并让增速可比。
        </p>
      </header>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">数据从哪来</h2>
        <p className="text-muted">
          全部数字来自 GitHub 公开 REST API 的 <code className="num text-body">stargazers_count</code>。
          每天 UTC 00:10 由 GitHub Actions 抓取一次并提交快照，站点只读这些快照，不临场请求 GitHub。
        </p>
        <p className="text-muted">
          快照自 2026-11-19 开始，不做历史回填。曲线少于 3 个点时显示「数据积累中」——这是产品规则，不是 bug。
        </p>
      </section>

      <section className="card card-pad">
        <h2 className="text-base font-semibold text-white">五个榜单怎么算</h2>
        <dl className="mt-3 divide-y divide-line/60">
          {BOARDS.map(([name, desc]) => (
            <div key={name} className="flex gap-4 py-2.5">
              <dt className="w-14 shrink-0 font-medium text-gold">{name}</dt>
              <dd className="text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">
          所有榜单只统计「在册且状态为 active」的仓库；缺快照的日子不参与计算，也不会用插值补。
        </p>
      </section>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">收录与退出</h2>
        <p className="text-muted">
          名单上限 100 个，是容量而不是终身席位。每月首个周一做准入评审；每周结算后允许挑战者替换，
          每期最多 5 席（5%），结算周冻结。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>硬性资格：公开非 fork、品类匹配、近 180 天活跃、README 与 LICENSE、star ≥ 100。</li>
          <li>退出原因：删除 / 归档、定位改变、90 天无更新、违规、被挑战替换、作者申请。</li>
          <li>退出后保留历史曲线，不 404；次日退出榜单；冷却 30 天，12 个月内最多进出 2 次。</li>
          <li>所有变更写入 changelog 并随 seed 文件提交到 git，可审计。</li>
        </ul>
        <p className="text-xs text-muted">
          完整规则见仓库 <code>docs/收录规则.md</code>；变更公示见后续的 /about/changelog。
        </p>
      </section>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">反注水</h2>
        <p className="text-muted">
          单日增量超过近 7 日均值的 5 倍、且没有发布 / 社区事件解释时，该日标记为「异常」。
          异常数据不删除、不参与均值，页面上会显式标注。
        </p>
      </section>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">更新、容错与免责</h2>
        <p className="text-muted">
          抓取失败会记录在快照的 failures 里并告警；缺日不补、绝不伪造。站点只做只读展示，
          Star 数据归 GitHub 与各仓库作者所有。本项目非 GitHub 或任何 harness 官方项目。
        </p>
        <Link to="/rankings/velocity" className="btn mt-2">
          去看竞速榜 →
        </Link>
      </section>
    </article>
  );
}
