import { Link } from 'react-router-dom';

const BOARDS = [
  ['竞速', '当日新增 star：相邻两个快照的差值，越大越靠前。'],
  ['增速', '近 7 / 30 天涨幅：(当前 - 基准) / 基准，基准日 star 需 ≥ 50。'],
  ['总榜', '当前 star 总量；并列按名称升序。'],
  ['黑马', '区间内总榜名次的跃升幅度。'],
  ['新秀', '收录名单内、仓库创建时间在最近 30 天、且 star ≥ 10 的项目。'],
];

export default function About() {
  return (
    <article className="prose-invert max-w-3xl space-y-6 text-sm leading-relaxed text-body">
      <header>
        <h1 className="text-2xl font-semibold text-white">数据口径与收录规则</h1>
        <p className="mt-2 text-muted">
          HarnessPack 只做一件事：把 DeepSeek Harness 插件的 star 变化如实记录下来，并让增速可比。
        </p>
      </header>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">数据从哪来</h2>
        <p className="text-muted">
          名单与分类来自 <a className="text-teal hover:underline" href="https://awesome-dsh-plugin.com" target="_blank" rel="noreferrer">awesome-dsh-plugin</a> 精选清单（CC0-1.0，约 1.1 万个仓库）：
          上游要求仓库必须能通过 <code>dsh plugin add</code> 安装（package.json 含 <code>dsh.bundle</code>），
          DSH 本体、桌面客户端、纯收录清单与跨 harness 应用不在范围内。
        </p>
        <p className="text-muted">
          全部数字来自 GitHub 公开 API 的 <code className="num text-body">stargazerCount</code>。
          每天 UTC 00:10 由 GitHub Actions 批量抓取一次并提交快照，站点只读这些快照，不临场请求 GitHub。
        </p>
        <p className="text-muted">
          快照自 2026-11-19 开始，不做历史回填。快照少于 2 天时显示「数据积累中」——这是产品规则，不是 bug。
        </p>
      </section>

      <section className="card card-pad">
        <h2 className="text-base font-semibold text-white">榜单怎么算</h2>
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
          分类榜沿用上游清单的 23 个分类，只在同一分类内重新排名。
        </p>
      </section>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">收录与退出</h2>
        <p className="text-muted">
          名单与分类直接采用 awesome-dsh-plugin 精选清单（CC0-1.0）：作者在该仓库提 PR，合并后我们每日同步，
          按仓库去重（同一仓库的多个子包只计一次），不重复做人工评审。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>收录：上游合并即进入名单，次日快照开始计 star；分类沿用上游的 23 个分类。</li>
          <li>退出：上游删除、仓库 404 / 归档、90 天无 push 且 star 无净增长，标记退出并保留历史曲线，不 404。</li>
          <li>变更：每次同步写入仓库 changelog，可审计；退出后重新被收录会自动恢复。</li>
          <li>提交收录请去 <a className="text-teal hover:underline" href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin" target="_blank" rel="noreferrer">awesome-dsh-plugin</a> 提 PR。</li>
        </ul>
        <p className="text-xs text-muted">
          完整规则见仓库 <code>docs/收录规则.md</code>；同步变更记录在 <code>data/catalog/changelog.jsonl</code>。
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
