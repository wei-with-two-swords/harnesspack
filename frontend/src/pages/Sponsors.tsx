import { Link } from 'react-router-dom';

export default function Sponsors() {
  return (
    <article className="max-w-3xl space-y-6 text-sm leading-relaxed text-body">
      <header>
        <h1 className="text-2xl font-semibold text-white">推荐位</h1>
        <p className="mt-2 text-muted">
          推荐位是本站唯一的商业化位置。它独立成块、明确标注「赞助」，不进入任何榜单排名，
          也不影响收录与退出评审。
        </p>
      </header>

      <section className="card card-pad">
        <h2 className="text-base font-semibold text-white">三条底线</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
          <li>物理隔离：赞助内容只出现在标注区块，不混排进榜单。</li>
          <li>品质门槛：只接受 DSH 插件或面向 DSH 开发者的工具，拒绝与收录名单直接竞争排名的投放。</li>
          <li>可关闭：用户可折叠，首屏不遮挡数据。</li>
        </ul>
      </section>

      <section className="card card-pad">
        <h2 className="text-base font-semibold text-white">本周编辑精选</h2>
        <div className="mt-3 rounded-lg border border-dashed border-line bg-surface/40 px-4 py-8 text-center">
          <div className="text-sm text-body">招商中</div>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted">
            首期只开放 3 个席位，按周计价。当前阶段优先邀请名单内的作者与工具类项目，
            先跑通展示与标注，再谈价格。
          </p>
          <p className="mt-3 text-xs text-muted">
            联系方式：在项目仓库提交 Issue，标题注明「推荐位」。
          </p>
        </div>
      </section>

      <section className="card card-pad space-y-2">
        <h2 className="text-base font-semibold text-white">为什么不做竞价排名</h2>
        <p className="text-muted">
          榜单的价值来自「数字可信」。一旦名次可以购买，所有 star 曲线都会失去解释力。
          推荐位与榜单分离，是这个小站的长期承诺。
        </p>
        <Link to="/rankings/velocity" className="btn mt-2">
          返回竞速榜 →
        </Link>
      </section>
    </article>
  );
}
