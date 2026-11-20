import { Link } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';

export default function Sponsors() {
  useTitle('推荐位', 'HarnessPack 的推荐位独立展示、明确标注赞助，绝不参与榜单排名。');
  return (
    <article className="fs-sm" style={{ maxWidth: '48rem' }}>
      <header className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-2">推荐位</h1>
        <p className="mb-0 fg-secondary">
          推荐位是本站唯一的商业化位置。它独立成块、明确标注「赞助」，不进入任何榜单排名，
          也不影响收录与退出评审。
        </p>
      </header>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">三条底线</h2>
          <ul className="mt-3 mb-0 ps-4 fg-secondary">
            <li className="mb-2">物理隔离：赞助内容只出现在标注区块，不混排进榜单。</li>
            <li className="mb-2">品质门槛：只接受 DSH 插件或面向 DSH 开发者的工具，拒绝与收录名单直接竞争排名的投放。</li>
            <li>可关闭：用户可折叠，首屏不遮挡数据。</li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">本周编辑精选</h2>
          <div className="mt-3 rounded-3 border bg-subtle-secondary px-4 py-5 text-center">
            <div className="fs-sm">招商中</div>
            <p className="mx-auto mt-2 mb-0 fs-xs fg-secondary" style={{ maxWidth: '28rem' }}>
              首期只开放 3 个席位，按周计价。当前阶段优先邀请名单内的作者与工具类项目，
              先跑通展示与标注，再谈价格。
            </p>
            <p className="mt-3 mb-0 fs-xs fg-secondary">
              联系方式：在项目仓库提交 Issue，标题注明「推荐位」。
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">为什么不做竞价排名</h2>
          <p className="mt-2 fg-secondary">
            榜单的价值来自「数字可信」。一旦名次可以购买，所有 star 曲线都会失去解释力。
            推荐位与榜单分离，是这个小站的长期承诺。
          </p>
          <Link to="/rankings/velocity" className="btn btn-solid theme-secondary mt-2">
            返回竞速榜 →
          </Link>
        </div>
      </section>
    </article>
  );
}
