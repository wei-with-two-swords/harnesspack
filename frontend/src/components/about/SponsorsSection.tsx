import { Link } from 'react-router-dom';

export default function SponsorsSection() {
  return (
    <section id="sponsors" className="card mb-4 hp-anchor">
      <div className="card-body">
        <h2 className="fs-xl fw-semibold mb-2">推荐位</h2>
        <p className="fs-sm fg-secondary">
          推荐位是本站唯一的商业化位置。它独立成块、明确标注「赞助」，不进入任何榜单排名，
          也不影响收录与退出评审。
        </p>

        <h3 className="fs-md fw-semibold mt-4">三条底线</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">物理隔离：赞助内容只出现在标注区块，不混排进榜单。</li>
          <li className="mb-1">品质门槛：只接受 DSH 插件或面向 DSH 开发者的工具，拒绝与收录名单直接竞争排名的投放。</li>
          <li>可关闭：用户可折叠，首屏不遮挡数据。</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">本周编辑精选</h3>
        <div className="mt-2 rounded-3 bg-subtle-secondary px-4 py-5 text-center">
          <div className="fs-sm">招商中</div>
          <p className="mx-auto mt-2 mb-0 fs-xs fg-secondary" style={{ maxWidth: 'var(--measure-narrow)' }}>
            首期只开放 3 个席位，按周计价。当前阶段优先邀请名单内的作者与工具类项目，
            先跑通展示与标注，再谈价格。
          </p>
          <p className="mt-3 mb-0 fs-xs fg-secondary">联系方式：在项目仓库提交 Issue，标题注明「推荐位」。</p>
        </div>

        <h3 className="fs-md fw-semibold mt-4">为什么不做竞价排名</h3>
        <p className="mt-2 mb-0 fs-sm fg-secondary">
          榜单的价值来自「数字可信」。一旦名次可以购买，所有 STAR 曲线都会失去解释力。
          推荐位与榜单分离，是这个小站的长期承诺。
        </p>
        <Link to="/rankings/velocity" className="btn btn-solid mt-3">
          返回近 24 小时榜
        </Link>
      </div>
    </section>
  );
}
